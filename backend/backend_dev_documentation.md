# Sameer Distributors Backend Developer Documentation

Welcome to the backend developer documentation for the Sameer Distributors Distribution Inventory & Accounts System. This document serves as the guide for engineers and LLMs to understand, maintain, and extend the Node.js/Express + Prisma application.

---

## 1. Architectural Design

The backend uses a strict **3-Layer Architecture** designed to optimize performance, clean boundaries, and transaction safety:

```
[Routes (Zod Validation)] ──> [Controllers (HTTP Env/Parsing)] ──> [Models (Prisma & Transactions)]
```

### Layer Responsibilities
* **Routes (`routes/`):** Define endpoints, assign middleware, and validate request body/query payloads using Zod schemas (`config/zod-schema.js`).
* **Controllers (`controllers/`):** Handle parsing request parameters, formatting HTTP success/error JSON response envelopes, and managing HTTP status codes (200, 201, 400, 404, 500).
* **Models (`models/`):** Contain all database queries, raw SQL logic, and transactional wrappers. **No business rule execution is allowed in controller or route layers.** All database states are altered through these models. No separate Service or Repository layers are used.

### Non-Negotiable Rules
1. **Transactions (`prisma.$transaction`):** Every action that updates multiple tables (e.g. creating an invoice, decrementing stock, and updating customer ledger balances) **must** run inside a database transaction to prevent partial writes.
2. **Pieces Only:** All inventory values and product quantities are stored and manipulated as plain integers representing individual pieces. Carton conversions are display-only memory aids for frontend renderers.

---

## 2. Core Business Engines

### A. The Stock Engine (`adjustStock`)
All inventory increases (`IN`) and decreases (`OUT`) must run through the `adjustStock` model function inside [stock-model.js](./models/stock-model.js):

```javascript
stockModel.adjustStock({ productId, quantity, type: 'IN'|'OUT', referenceType, referenceId, description, createdById }, tx)
```

* **Atomic Stock Checks:** For `OUT` movements, the engine enforces a strict constraint on the database update call where the operation only proceeds if `stockQuantity >= -delta`. This prevents concurrent transactions from overselling products.
* **Audit Trail:** Every stock change automatically registers a corresponding row in the `StockMovement` table within the same transaction block.

### B. Customer and Supplier Ledgers
Ledger records are running records of account balances. These are updated atomically when purchases, sales, returns, or payments occur.
* **Prisma Enum Limitations:** Due to schema constraints, the `ReferenceType` enum is limited to `[PURCHASE, INVOICE, SALES_RETURN, PURCHASE_RETURN, ADJUSTMENT]`. Therefore:
  * Customer payments must log `referenceType: 'INVOICE'`.
  * Supplier payments must log `referenceType: 'PURCHASE'`.
* **Atomic Balance Snapshotting:** Ledger entries atomically update target customer/supplier balances using database increments (`{ increment: delta }`) and snapshot that specific running balance onto the ledger row.

### C. Sequential Document Numbering
The helper `generateDocNumber(tx, prefixKey, prefixString)` in [doc-number.js](file:///c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/config/doc-number.js) guarantees sequential, zero-padded document numbers using atomic Prisma transaction queries:
* **Invoices:** `INV-000001`, `INV-000002`
* **Sales Returns:** `SR-000001`, `SR-000002`
* **Purchases:** `PUR-000001`, `PUR-000002`
* **Purchase Returns:** `PR-000001`, `PR-000002`

---

## 3. Route & API Endpoints Directory

All routes are mounted under the `/api` prefix inside the Express app, protected by JWT extraction middleware.

### Authentication & Profiles
* `POST /api/auth/register` - Registers a new user. Secured via a server-configured `REGISTRATION_SECRET` token.
* `POST /api/auth/login` - Logs in and issues an httpOnly cookie containing the JWT.
* `POST /api/auth/logout` - Clear cookie.
* `GET /api/user/me` - Resolves the profile of the current logged-in user.
* `POST /api/user/:id/reset-password` - Admin-only password reset endpoint (secured by `authorize('ADMIN')`).

### Master Data CRUD
All endpoints support standard listings with pagination (`?page=1&limit=10`), text-search filters, and active filters.
* `/api/product` - Product listings, creations, SKU/barcode lookups, and inventory status flags.
* `/api/product-category` - Product categories.
* `/api/customer` - Customer registrations, status toggles, and balance reconciliations.
* `/api/supplier` - Supplier records.
* `/api/salesman` - Salesman directories (login-less records tagged on Invoices).
* `/api/expense-category` - Categorized expense targets (Utilities, wages, transport, etc.).

### Purchases & Returns (Phase 5)
* `POST /api/purchase` - Creates buy-in invoice, increments stock, and increases supplier balance due.
* `GET /api/purchase` - Lists purchase history.
* `POST /api/purchase-return` - Returns product, decrements stock, and decrements supplier balance.

### Sales & Returns (Phase 6)
* `POST /api/invoice` - Records cash/credit sales, decrements stock, records cash payments, and charges credit customer ledgers.
* `GET /api/invoice` - Lists sales history.
* `POST /api/sales-return` - Registers customer returns, increments stock, and credits ledger values.

### Payments & Settlements (Phase 7)
* `POST /api/payment/customer` - Logs customer account payments (supports paying specific invoices or general overall balance). Overpayments are blocked.
* `POST /api/payment/supplier` - Logs supplier payments.
* `GET /api/payment/customer` & `GET /api/payment/supplier` - Returns payment records.

### Salesmen Targets & Expenses (Phase 8)
* `POST /api/sales-target/salesman/:id/target` - Sets target amount for a salesman for a specific month (e.g. `"2026-07"`).
* `GET /api/sales-target/salesman/:id/target` - Lists salesman targets.
* `GET /api/sales-target/salesman/:id/achievement?month=YYYY-MM` - Evaluates targets vs actual sales (net of returns) and progress percentages.
* `/api/expense` - Record and list categorized business expenses.

### Analytical Reports (Phase 9)
* `GET /api/report/dashboard` - Dashboard stats (Today/Week/Month sales, receivables, payables, monthly expenses, net profits, low stock counts).
* `GET /api/report/sales` - Grouped daily sales.
* `GET /api/report/sales-by-salesman` - Sales performance leaderboard.
* `GET /api/report/purchases` - Grouped daily purchases.
* `GET /api/report/current-stock` - Current inventory assets valued at cost vs selling prices.
* `GET /api/report/low-stock` - Products below reorder limits.
* `GET /api/report/customer-ledger` - Customer ledger balances split into aging buckets (`0-30 days`, `31-60 days`, `60+ days`).
* `GET /api/report/supplier-ledger` - Supplier balance ledger list.
* `GET /api/report/profit` - Period profitability checks.
* `GET /api/report/expense` - Categorized expense aggregates.
* `GET /api/report/net-profit` - Period profit margins.

---

## 4. How to Run Verification Scripts

A set of automated testing scripts is stored in the `backend/scratch/` folder. They run against your local database using parameters loaded from your `backend/.env` file. 

To run the verification checks:

1. **Verify Stock Engine & Concurrency:**
   ```bash
   cd backend
   node scratch/verify-stock.js
   ```
2. **Verify Purchases & Supplier Returns:**
   ```bash
   cd backend
   node scratch/verify-purchase.js
   ```
3. **Verify Sales, Returns, & Ledger Payments:**
   ```bash
   cd backend
   node scratch/verify-sales-payments.js
   ```
4. **Verify Aggregations, Targets, & Reports:**
   ```bash
   cd backend
   node scratch/verify-reports.js
   ```
5. **Verify Admin Password Reset:**
   ```bash
   cd backend
   node scratch/verify-reset-password.js
   ```
