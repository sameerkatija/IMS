# Prompt: Implement Phase 8 (Salesmen Targets & Expenses) & Phase 9 (Reports & Dashboard)

You are an expert backend developer. Your task is to implement Phase 8 (Salesmen, Targets & Business Expenses) and Phase 9 (Reports & Dashboard backend aggregation) in our Node/Express + Prisma application.

---

### Architectural Rules
- **No separate Service/Repo layers**: All Prisma queries, raw SQL queries, and logic go inside the `models/` files.
- **Prisma Transactions**: Use `prisma.$transaction` where operations need database atomicity.
- **Response Format**:
  - Success: `{ type: "success", message: "Optional message", data: ... }` (with a `pagination` metadata object on list endpoints).
  - Error: `{ type: "error", message: "Error message detail" }`.
- **Authentication**: Retrieve the current user's ID from `req.user.id` to set `createdById`.
- **Database Schema Alignment**: Make sure to use `lowStockLevel` (from our schema) instead of `reorderLevel` for low stock check calculations.

---

### Step 1: Add Schemas to `backend/config/zod-schema.js`
Append the following validation schemas to `backend/config/zod-schema.js`:

1. `setTargetSchema`:
   - `month`: Date string matching format `YYYY-MM` (e.g. `2026-07`).
   - `targetAmount`: Positive number.
   - `description`: Optional string.

2. `createExpenseSchema`:
   - `categoryId`: Positive integer.
   - `amount`: Positive number.
   - `expenseDate`: Optional valid date/date string.
   - `description`: Optional string.

---

### Step 2: Create `backend/models/sales-target-model.js`
Implement the model logic for setting and retrieving monthly salesmen targets:

1. **`setTarget(salesmanId, { month, targetAmount, description, createdById })`**:
   - Parse the `month` string (e.g., `"2026-07"`) and normalize it to the **first day of the month** in UTC midnight (e.g., `2026-07-01T00:00:00Z`).
   - Perform a Prisma `upsert` on the `SalesTarget` model using the unique compound index `[salesmanId, month]`:
     - If it exists, update `targetAmount`, `description`, and `createdById`.
     - If it does not, create it.
2. **`listTargets(salesmanId)`**:
   - Retrieve all target records for the salesman, ordered by `month` desc.
3. **`getAchievement(salesmanId, monthStr)`**:
   - Normalize `monthStr` (e.g. `"2026-07"`) to find `monthStart` (first day of the month) and `monthEnd` (first day of the next month).
   - Find the `SalesTarget` amount for the salesman for that month.
   - Calculate gross sales (sum of `Invoice.total` attributed to the salesman where `invoiceDate` is within `[monthStart, monthEnd)`).
   - Calculate sales returns (sum of `SalesReturn.totalAmount` linked to that salesman's invoices where `returnDate` is within `[monthStart, monthEnd)`).
   - Calculate net sales: `actualSales = grossSales - returns`.
   - Calculate `achievedPercent = targetAmount > 0 ? (actualSales / targetAmount) * 100 : null` (rounded to 2 decimal places).
   - Return `{ salesmanId, salesmanName, month, targetAmount, grossSales, returns, actualSales, achievedPercent }`.

---

### Step 3: Create `backend/models/expense-model.js`
Implement simple CRUD/Insert logic for Expenses:

1. **`createExpense({ categoryId, amount, expenseDate, description, createdById })`**:
   - Verify the `ExpenseCategory` exists and is active.
   - Create the `Expense` row in Prisma.
2. **`listExpenses({ where, skip, take })`** and **`countExpenses(where)`**:
   - Query helpers for listing expenses, including category name, ordered by `expenseDate` desc.

---

### Step 4: Create `backend/models/report-model.js`
This file implements all aggregated dashboard metrics and queries using Prisma or raw SQL query blocks (`prisma.$queryRaw`):

1. **`getDashboardMetrics()`**:
   - Calculate date anchors: `todayStart`, `todayEnd`, `weekStart`, `monthStart`.
   - Return:
     - `todaySales`: Sum of `Invoice.total` for today.
     - `weekSales`: Sum of `Invoice.total` for the last 7 days.
     - `monthSales`: Sum of `Invoice.total` for this calendar month.
     - `totalReceivables`: Sum of `Customer.balance` where `balance > 0`.
     - `totalPayables`: Sum of `Supplier.balance` where `balance > 0`.
     - `lowStockCount`: Count of active products where `stockQuantity <= lowStockLevel`.
     - `topProducts`: Top 5 products by revenue generated in the current month (grouped by `productId` in `InvoiceItem`, summing `totalPrice`, and joining product details).
     - `monthExpenses`: Sum of `Expense.amount` for this month.
     - `monthNetProfit`: Gross profit (profit report total) minus monthly expenses.
2. **`salesByDay(from, to, customerId)`**:
   - Group invoices by day using a raw SQL block. Return date, count of invoices, and total sales.
3. **`salesBySalesman(from, to)`**:
   - Sum invoice totals per salesman in the period, subtract any linked sales return totals, and return net salesman sales list.
4. **`purchasesByDay(from, to, supplierId)`**:
   - Group purchases by day using raw SQL. Return date, count, and total purchase value.
5. **`currentStockReport()`**:
   - List active products showing `id`, `name`, `sku`, `stockQuantity`, `costPrice`, `sellingPrice`, `valueAtCost = costPrice * stockQuantity`, and `valueAtSellingPrice = sellingPrice * stockQuantity`. Include sum totals of both valuations.
6. **`lowStockReport()`**:
   - List active products where `stockQuantity <= lowStockLevel` ordered by deficiency severity.
7. **`customerLedgerReport()`**:
   - List customers with outstanding balances (`balance > 0`).
   - Group their open invoices (`balanceDue > 0`) into aging buckets based on `invoiceDate`:
     - `0-30 days`
     - `31-60 days`
     - `60+ days`
8. **`supplierLedgerReport()`**:
   - List suppliers with outstanding balances (`balance > 0`).
9. **`profitReport(from, to)`**:
   - Calculate profit using raw SQL since it requires arithmetic on columns:
     ```sql
     SELECT COALESCE(SUM(("unitPrice" - "costPriceAtSale") * quantity), 0)::numeric AS profit
     FROM "InvoiceItem" ii
     JOIN "Invoice" i ON i.id = ii."invoiceId"
     WHERE i."invoiceDate" >= ${from} AND i."invoiceDate" <= ${to}
     ```
10. **`expenseReport(from, to)`**:
    - Group expenses by category and return category totals.
11. **`netProfitReport(from, to)`**:
    - Calculate gross profit (profit report formula) and total expenses, then return net profit.

---

### Step 5: Create Controllers
1. **`backend/controllers/sales-target-controller.js`**:
   - Handles routes for setting targets, listing targets, and checking target achievement.
2. **`backend/controllers/expense-controller.js`**:
   - Standard CRUD handlers for Expenses and Expense Categories.
3. **`backend/controllers/report-controller.js`**:
   - Handlers mapping to each method in `report-model.js`. Ensure query parameters `from` and `to` are parsed correctly, defaulting to the last 7 days if omitted.

---

### Step 6: Create Routes and Mount Them
1. **`backend/routes/sales-target-route.js`**:
   - `POST /salesman/:id/target` (Validated by `setTargetSchema`, sets target)
   - `GET /salesman/:id/target` (List targets)
   - `GET /salesman/:id/achievement` (Gets achievement, expects `?month=YYYY-MM`)
2. **`backend/routes/expense-route.js`**:
   - `POST /` (Validated by `createExpenseSchema`, creates expense)
   - `GET /` (List and filter expenses)
3. **`backend/routes/report-route.js`**:
   - Mount endpoints:
     - `GET /dashboard`
     - `GET /sales`
     - `GET /sales-by-salesman`
     - `GET /purchases`
     - `GET /current-stock`
     - `GET /low-stock`
     - `GET /customer-ledger`
     - `GET /supplier-ledger`
     - `GET /profit`
     - `GET /expense`
     - `GET /net-profit`
4. Mount them in `backend/routes/index.js` under the `isAuthenticated` middleware:
   ```javascript
   router.use('/sales-target', require('./sales-target-route'));
   router.use('/expense', require('./expense-route'));
   router.use('/report', require('./report-route'));
   ```
