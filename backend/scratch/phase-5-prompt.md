# Prompt: Implement Phase 5 — Purchases & Purchase Returns

You are an expert backend developer. Your task is to implement Phase 5 (Purchases & Purchase Returns) in our Express + Prisma application.

This phase implements the recording of stock buy-ins from suppliers (which increases stock and supplier balance) and returns back to suppliers (which decreases stock and supplier balance).

### Architectural Rules
- **No separate Service/Repo layers**: All Prisma queries and transaction orchestration go inside the `models/` files.
- **Transactional Integrity**: All complex operations (Purchase creation, Purchase Return creation) must run inside a single database transaction (`prisma.$transaction`) so that partial failures roll back completely.
- **Stock Integration**: Call `stockModel.adjustStock(..., tx)` for stock adjustments, passing the active transaction client `tx`.
- **Response Format**:
  - Success: `{ type: "success", message: "Optional message", data: ... }` (with a `pagination` metadata object on list endpoints).
  - Error: `{ type: "error", message: "Error message detail" }`.
- **Authentication**: Retrieve the current user's ID from `req.user.id` to set `createdById`.

---

### Step 1: Add Schemas to `backend/config/zod-schema.js`
Append the following validation schemas to `backend/config/zod-schema.js`:

1. `createPurchaseSchema`:
   - `supplierId`: Positive integer.
   - `purchaseDate`: Optional valid date/date string.
   - `discount`: Optional non-negative number (defaults to 0).
   - `notes`: Optional string.
   - `items`: Non-empty array of items:
     - `productId`: Positive integer.
     - `quantity`: Positive integer (pieces).
     - `unitCost`: Non-negative number.

2. `createPurchaseReturnSchema`:
   - `supplierId`: Positive integer.
   - `purchaseId`: Positive integer.
   - `returnDate`: Optional valid date/date string.
   - `reason`: Optional string.
   - `items`: Non-empty array of items:
     - `productId`: Positive integer.
     - `quantity`: Positive integer (pieces).
     - `unitCost`: Non-negative number.

---

### Step 2: Create Document Number Generator in `backend/config/doc-number.js`
Create a utility function to generate sequential, human-friendly document numbers (e.g. `PUR-000001` or `PR-000001`):

```javascript
async function generateDocNumber(tx, modelName, prefix, padLength = 6) {
  const count = await tx[modelName].count();
  const next = count + 1;
  return `${prefix}-${String(next).padStart(padLength, '0')}`;
}

module.exports = { generateDocNumber };
```

---

### Step 3: Create `backend/models/ledger-model.js`
This file manages ledger logging and customer/supplier balance updates. It must perform the operations atomically using the active transaction client `tx`:

*   **`recordSupplierLedgerEntry({ supplierId, debit = 0, credit = 0, referenceType, referenceId, notes }, tx)`**:
    1. Calculate `delta = credit - debit`.
    2. Atomically update the supplier's balance using Prisma's `increment` function:
       ```javascript
       const supplier = await tx.supplier.update({
         where: { id: supplierId },
         data: { balance: { increment: delta } }
       });
       ```
    3. Insert a `SupplierLedger` record with the running `balance` equal to the updated `supplier.balance`.

---

### Step 4: Create `backend/models/purchase-model.js`
Implement the DB models and transaction logic for Purchases:

1. **`createPurchase({ supplierId, purchaseDate, discount, notes, items, createdById })`**:
   - Wrap the operation in a transaction: `prisma.$transaction(async (tx) => { ... })`.
   - Verify the supplier exists.
   - Loop and validate all products. Compute `subtotal` (sum of `quantity * unitCost` per item).
   - Compute `total = subtotal - discount`. Validate that `total >= 0`.
   - Generate `purchaseNo` using `generateDocNumber(tx, 'purchase', 'PUR')`.
   - Create the `Purchase` record (saving `purchaseNo`, `supplierId`, `subtotal`, `discount`, `total`, `notes`, `createdById`).
   - For each item:
     - Create a `PurchaseItem` record.
     - Call `stockModel.adjustStock({ productId, quantity, type: 'IN', referenceType: 'PURCHASE', referenceId: purchase.id, createdById, notes }, tx)`.
   - If `total > 0`, call `ledgerModel.recordSupplierLedgerEntry` to post a ledger `credit` for the `total` amount (increases what we owe the supplier).
   - Return the created purchase.

2. **`getAllPurchases({ where, skip, take })`** and **`countPurchases(where)`**:
   - Query helpers for listing purchases, ordering by `createdAt` desc, and including `supplier` name and the count of items.
3. **`getPurchaseById(id)`**:
   - Fetch a single purchase by ID, including its `items` (joined with `product` details) and `supplier` details.

---

### Step 5: Create `backend/models/purchase-return-model.js`
Implement the DB models and validation logic for Purchase Returns:

1. **`createPurchaseReturn({ supplierId, purchaseId, returnDate, reason, items, createdById })`**:
   - Wrap the operation in a transaction: `prisma.$transaction(async (tx) => { ... })`.
   - Verify the supplier exists.
   - Fetch the original `Purchase` (include its items, and existing returns + return items) to validate quantities:
     ```javascript
     const purchase = await tx.purchase.findUnique({
       where: { id: purchaseId },
       include: { items: true, returns: { include: { items: true } } }
     });
     ```
   - For each item in the return:
     - Check that the returned product was part of the original purchase.
     - Calculate remaining returnable quantity: `remaining = purchasedQty - alreadyReturnedQty`.
     - Reject if `quantity > remaining`.
   - Compute the return `totalAmount` (sum of `quantity * unitCost` of returned items).
   - Generate `returnNo` using `generateDocNumber(tx, 'purchaseReturn', 'PR')`.
   - Create the `PurchaseReturn` record.
   - For each item:
     - Create a `PurchaseReturnItem` record.
     - Call `stockModel.adjustStock({ productId, quantity, type: 'OUT', referenceType: 'PURCHASE_RETURN', referenceId: purchaseReturn.id, createdById, notes: reason }, tx)`.
   - If `totalAmount > 0`, call `ledgerModel.recordSupplierLedgerEntry` to post a ledger `debit` for the `totalAmount` (reduces what we owe the supplier).
   - Return the created purchase return.

2. **`getAllPurchaseReturns({ where, skip, take })`** and **`countPurchaseReturns(where)`**:
   - Query helpers for listing returns.
3. **`getPurchaseReturnById(id)`**:
   - Fetch a single purchase return by ID, including its items and original purchase info.

---

### Step 6: Create Controllers
1. **`backend/controllers/purchase-controller.js`**:
   - `createPurchase`: Parses inputs, sets `createdById = req.user.id`, calls `purchaseModel.createPurchase`, returns HTTP 201 with success envelope.
   - `listPurchases`: Parses pagination and filters (`supplierId`, `from` date, `to` date), calls list and count query helpers, returns HTTP 200 with standard pagination envelope.
   - `getPurchaseById`: Extracts ID from `req.params.id`, calls model, returns purchase details.
2. **`backend/controllers/purchase-return-controller.js`**:
   - Similar actions for `createPurchaseReturn`, `listPurchaseReturns`, and `getPurchaseReturnById`.

---

### Step 7: Create Routes and Mount Them
1. **`backend/routes/purchase-route.js`**:
   - `POST /` (Validated by `createPurchaseSchema`, calls `createPurchase`)
   - `GET /` (Calls `listPurchases`)
   - `GET /:id` (Calls `getPurchaseById`)
2. **`backend/routes/purchase-return-route.js`**:
   - `POST /` (Validated by `createPurchaseReturnSchema`, calls `createPurchaseReturn`)
   - `GET /` (Calls `listPurchaseReturns`)
   - `GET /:id` (Calls `getPurchaseReturnById`)
3. Mount them in `backend/routes/index.js` under the `isAuthenticated` middleware:
   ```javascript
   router.use('/purchase', require('./purchase-route'));
   router.use('/purchase-return', require('./purchase-return-route'));
   ```
