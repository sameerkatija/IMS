# Prompt: Implement Phase 6 (Sales/Invoices) & Phase 7 (Payments)

You are an expert backend developer. Your task is to implement Phase 6 (Sales/Invoices & Sales Returns) and Phase 7 (Payments) in our Express + Prisma application.

These two phases handle:
1. Recording sales (invoices), deducting stock, creating customer payments and customer ledger entries (Phase 6).
2. Processing sales returns, adding stock back, and crediting customer ledgers (Phase 6).
3. Recording customer and supplier payments, and adjusting their balance ledgers atomically (Phase 7).

---

### Architectural Rules
- **No separate Service/Repo layers**: All Prisma queries and transaction orchestration go inside the `models/` files.
- **Transactional Integrity**: All updates (Invoice creation, Sales Return creation, Payments) must run inside a single database transaction (`prisma.$transaction`) so that partial failures roll back completely.
- **Stock Integration**: Call `stockModel.adjustStock(..., tx)` for stock adjustments, passing the active transaction client `tx`.
- **Response Format**:
  - Success: `{ type: "success", message: "Optional message", data: ... }` (with a `pagination` metadata object on list endpoints).
  - Error: `{ type: "error", message: "Error message detail" }`.
- **Authentication**: Retrieve the current user's ID from `req.user.id` to set `createdById`.

---

### Step 1: Add Schemas to `backend/config/zod-schema.js`
Append the following validation schemas to `backend/config/zod-schema.js`:

1. `createInvoiceSchema`:
   - `customerId`: Optional positive integer. Required if `saleType === 'CREDIT'` or if there's any outstanding `balanceDue > 0`.
   - `salesmanId`: Optional positive integer.
   - `saleType`: Optional enum (`CASH`, `CREDIT`). Defaults to `CASH`.
   - `invoiceDate`: Optional valid date/date string.
   - `discount`: Optional non-negative number (defaults to 0).
   - `paidAmount`: Optional non-negative number (defaults to 0).
   - `notes`: Optional string.
   - `items`: Non-empty array of items:
     - `productId`: Positive integer.
     - `quantity`: Positive integer (pieces).
     - `unitPrice`: Optional non-negative number (defaults to product's current selling price).

2. `createSalesReturnSchema`:
   - `customerId`: Optional positive integer.
   - `invoiceId`: Optional positive integer.
   - `returnDate`: Optional valid date/date string.
   - `reason`: Optional string.
   - `items`: Non-empty array of items:
     - `productId`: Positive integer.
     - `quantity`: Positive integer (pieces).
     - `unitPrice`: Optional non-negative number (defaults to product's current selling price).

3. `createCustomerPaymentSchema`:
   - `customerId`: Positive integer.
   - `invoiceId`: Optional positive integer.
   - `amount`: Positive number.
   - `paymentDate`: Optional valid date/date string.
   - `notes`: Optional string.

4. `createSupplierPaymentSchema`:
   - `supplierId`: Positive integer.
   - `purchaseId`: Optional positive integer.
   - `amount`: Positive number.
   - `paymentDate`: Optional valid date/date string.
   - `notes`: Optional string.

---

### Step 2: Implement Customer Ledger in `backend/models/ledger-model.js`
Implement the customer ledger logic in `backend/models/ledger-model.js` using the transaction client `tx`:

*   **`recordCustomerLedgerEntry({ customerId, debit = 0, credit = 0, referenceType, referenceId, notes }, tx)`**:
    1. Calculate `delta = debit - credit`.
    2. Atomically update the customer's balance using Prisma's `increment` function:
       ```javascript
       const customer = await tx.customer.update({
         where: { id: customerId },
         data: { balance: { increment: delta } }
       });
       ```
    3. Insert a `CustomerLedger` record with the running `balance` equal to the updated `customer.balance`.

---

### Step 3: Create `backend/models/invoice-model.js`
Implement the DB models and transaction logic for Invoices:

1. **`createInvoice({ customerId, salesmanId, saleType, invoiceDate, discount, paidAmount, notes, items, createdById })`**:
   - Wrap in a transaction: `prisma.$transaction(async (tx) => { ... })`.
   - Validate customer (if `customerId` provided) and salesman (if `salesmanId` provided).
   - Loop and validate all products. Calculate `subtotal` using overridden or default product `sellingPrice`.
   - Snapshots the product's CURRENT `costPrice` as `costPriceAtSale` for each item (crucial for profit reports).
   - Calculate `total = subtotal - discount` and `balanceDue = total - paidAmount`.
   - Enforce constraints:
     - If `saleType === 'CREDIT'`, `customerId` must be present.
     - If `balanceDue > 0`, `customerId` must be present.
     - `paidAmount` cannot be negative or exceed `total`.
   - Generate `invoiceNo` using `generateDocNumber(tx, 'invoice', 'INV')` from `backend/config/doc-number.js`.
   - Create the `Invoice` record.
   - For each item:
     - Create an `InvoiceItem` record.
     - Call `stockModel.adjustStock({ productId, quantity, type: 'OUT', referenceType: 'INVOICE', referenceId: invoice.id, createdById, notes }, tx)`.
   - If `paidAmount > 0`:
     - Create a `CustomerPayment` record (representing cash paid at the counter).
   - If `balanceDue > 0`:
     - Call `ledgerModel.recordCustomerLedgerEntry` to post a ledger `debit` for `balanceDue` (increases what they owe us).
   - Return the created invoice.

2. **`getAllInvoices({ where, skip, take })`** and **`countInvoices(where)`**:
   - Query helpers for listing invoices, including customer name, salesman name, and total items, ordered by `createdAt` desc.
3. **`getInvoiceById(id)`**:
   - Fetch a single invoice by ID, including its `items` (joined with `product` details) and `customer` details.

---

### Step 4: Create `backend/models/sales-return-model.js`
Implement the DB models and transaction logic for Sales Returns:

1. **`createSalesReturn({ customerId, invoiceId, returnDate, reason, items, createdById })`**:
   - Wrap in a transaction.
   - If `invoiceId` is provided:
     - Fetch the `Invoice` (including items and existing returns + return items) to validate quantities.
     - Calculate remaining returnable quantity: `remaining = soldQty - alreadyReturnedQty` for each item. Reject if `quantity > remaining`.
   - Loop items: calculate return `totalAmount` based on returned quantities and unit price.
   - Generate `returnNo` using `generateDocNumber(tx, 'salesReturn', 'SR')`.
   - Create the `SalesReturn` record.
   - For each item:
     - Create a `SalesReturnItem` record.
     - Call `stockModel.adjustStock({ productId, quantity, type: 'IN', referenceType: 'SALES_RETURN', referenceId: salesReturn.id, createdById, notes: reason }, tx)`.
   - If `totalAmount > 0` and customer is attributed:
     - Call `ledgerModel.recordCustomerLedgerEntry` to post a ledger `credit` for the return amount (reduces what they owe us, can go negative).
   - Return the created sales return.

2. **`getAllSalesReturns({ where, skip, take })`** and **`countSalesReturns(where)`**:
   - Query helpers for listing sales returns.
3. **`getSalesReturnById(id)`**:
   - Fetch a single sales return by ID.

---

### Step 5: Create `backend/models/payment-model.js`
Implement the DB models and transaction logic for Payments:

1. **`recordCustomerPayment({ customerId, invoiceId, amount, paymentDate, notes, createdById })`**:
   - Wrap in a transaction.
   - Verify the customer exists.
   - If `invoiceId` is provided:
     - Verify the invoice belongs to the customer.
     - Verify `amount <= invoice.balanceDue`. Reject overpayment.
   - Else (general payment):
     - Verify `amount <= customer.balance`. Reject overpayment beyond outstanding balance.
   - Create a `CustomerPayment` record.
   - If `invoiceId` is provided:
     - Update the `Invoice` record's `paidAmount`, `balanceDue`, and `status`. Recalculate status: `status = paidAmount >= total ? 'PAID' : 'PARTIALLY_PAID'`.
   - Call `ledgerModel.recordCustomerLedgerEntry` to post a ledger `credit` for the payment amount. Use `referenceType: invoice ? 'INVOICE' : 'PAYMENT'`.
   - Return the created payment.

2. **`recordSupplierPayment({ supplierId, purchaseId, amount, paymentDate, notes, createdById })`**:
   - Wrap in a transaction.
   - Verify the supplier exists.
   - Verify `amount <= supplier.balance`. Reject overpayment.
   - If `purchaseId` is provided:
     - Verify the purchase belongs to the supplier.
   - Create a `SupplierPayment` record.
   - Call `ledgerModel.recordSupplierLedgerEntry` to post a ledger `debit` for the payment amount. Use `referenceType: purchase ? 'PURCHASE' : 'PAYMENT'`.
   - Return the created payment.

3. **`getAllCustomerPayments({ where, skip, take })`** / **`countCustomerPayments(where)`**
4. **`getAllSupplierPayments({ where, skip, take })`** / **`countSupplierPayments(where)`**

---

### Step 6: Create Controllers
1. **`backend/controllers/invoice-controller.js`**:
   - `createInvoice`: Calls `invoiceModel.createInvoice`, returns HTTP 201 with success envelope.
   - `listInvoices`: Parses pagination/filters (`customerId`, `salesmanId`, `status`, `saleType`, date ranges), returns HTTP 200.
   - `getInvoiceById`: Returns invoice details by ID.
2. **`backend/controllers/sales-return-controller.js`**:
   - Similar actions for `createSalesReturn`, `listSalesReturns`, and `getSalesReturnById`.
3. **`backend/controllers/payment-controller.js`**:
   - `recordCustomerPayment`: Calls `paymentModel.recordCustomerPayment`, returns HTTP 201.
   - `listCustomerPayments`: Returns customer payments list.
   - `recordSupplierPayment`: Calls `paymentModel.recordSupplierPayment`, returns HTTP 201.
   - `listSupplierPayments`: Returns supplier payments list.

---

### Step 7: Create Routes and Mount Them
1. **`backend/routes/invoice-route.js`**:
   - `POST /` (Validated by `createInvoiceSchema`, calls `createInvoice`)
   - `GET /` (Calls `listInvoices`)
   - `GET /:id` (Calls `getInvoiceById`)
2. **`backend/routes/sales-return-route.js`**:
   - `POST /` (Validated by `createSalesReturnSchema`, calls `createSalesReturn`)
   - `GET /` (Calls `listSalesReturns`)
   - `GET /:id` (Calls `getSalesReturnById`)
3. **`backend/routes/payment-route.js`**:
   - `POST /customer` (Validated by `createCustomerPaymentSchema`, calls `recordCustomerPayment`)
   - `GET /customer` (Calls `listCustomerPayments`)
   - `POST /supplier` (Validated by `createSupplierPaymentSchema`, calls `recordSupplierPayment`)
   - `GET /supplier` (Calls `listSupplierPayments`)
4. Mount them in `backend/routes/index.js` under the `isAuthenticated` middleware:
   ```javascript
   router.use('/invoice', require('./invoice-route'));
   router.use('/sales-return', require('./sales-return-route'));
   router.use('/payment', require('./payment-route'));
   ```
