# Distribution Inventory Management System — Master Plan

> **LLM CONTEXT / SOURCE OF TRUTH — Read this before doing anything else**
>
> This document is the single source of truth for the inventory + accounts system for the SameerTraderz FMCG distribution business. It is a production-grade system.
>
> - **Actual Folder Structure:**
>   - `backend/`: Express server + Prisma + PostgreSQL (formerly referred to as `server/` in legacy notes).
>   - `client/`: React client (Vite + Tailwind).
> - **Units:** Everything is tracked in **pieces only**. There is no Unit/UnitConversion system. `Product.piecesPerCarton` is a *display-only memory aid* for counter staff; it is never used in calculations.
> - **Field Alignment:** 
>   - The low stock threshold field is called `lowStockLevel` in the database schema (do NOT use `reorderLevel`).
>   - Notes fields are strictly named `description` (or `reason` for returns).
> - **Database Enum Limitations:** The `ReferenceType` enum defined in `schema.prisma` is constrained to `[PURCHASE, INVOICE, SALES_RETURN, PURCHASE_RETURN, ADJUSTMENT]`. It does *not* contain a `PAYMENT` value. Consequently:
>   - Customer payments use `referenceType: 'INVOICE'` for ledger entries.
>   - Supplier payments use `referenceType: 'PURCHASE'` for ledger entries.
> - **Non-negotiable Architecture Rules:** Routes -> Controllers -> Models separation. All Prisma queries and transaction orchestrations go inside `models/` files. Request/response handling, HTTP status codes, and input validation routing belong in controllers and routes. No separate Service/Repository layers.

**Business:** Single FMCG distribution business (diapers, tissues, wipes, soaps)
**Users:** Internal admin and staff, no customer-facing portal
**Currency:** PKR only
**Deployment:** Local PC only (single location, no multi-warehouse)
**Stack:** React + Vite + Tailwind (client) · Node.js + Express (backend) · PostgreSQL + Prisma · JWT (httpOnly cookies) + bcrypt

---

## Architecture Rules (apply to all phases)

1. Database schema is built first, completely, before any application code.
2. Three layers: `routes/` define endpoints and validate requests using Zod schemas; `controllers/` handle request/response formatting, envelopes, and parsing; `models/` contain Prisma queries, raw SQL, and transaction orchestrations (`prisma.$transaction`).
3. Every inventory or financial write operation is wrapped in a transaction. Partial commits are strictly prohibited.
4. Stock is updated atomically inside transactions via a single `adjustStock()` model function that writes a `StockMovement` log and adjusts `Product.stockQuantity`.
5. Every completed phase must pass its verification scripts before moving to the next.

---

## Folder Structure

```
client/                      → React app (Vite + Tailwind)
backend/
  config/                    → env, prisma client, zod-schema, doc-number
  routes/                    → route definitions and validation middlewares
  controllers/               → req/res handling and status code management
  models/                    → Prisma queries + transactions + raw SQL logic
  middlewares/               → auth, error handling, validation
  scratch/                   → verification scripts, thunder client collections
  prisma/
    schema.prisma
    migrations/
    seed.js
```

---

## Naming Conventions

| Item | Convention | Example |
|---|---|---|
| DB Tables | PascalCase | `InvoiceItem` |
| DB Columns | camelCase | `stockQuantity` |
| Files | kebab-case | `stock-controller.js` |
| React Components | PascalCase | `InvoiceForm.jsx` |
| Variables/Functions | camelCase | `adjustStock()` |
| REST Routes | plural kebab-case | `/api/invoice` |

---

## Phase Status Summary

- **Phase 0 through Phase 10:** `[COMPLETED]` (Backend and frontend completely built, validated, and verified).
- **Admin Password Reset & SuperAdmin Key Reset Features:** `[COMPLETED]` (Bcrypt-hashed password updates for admins, plus anonymous forgot password resets via secure env SUPERADMINKEY validation).
- **Phase 11 — Hardening & Deployment:** `[TODO]`.

---

## Phase 0 — Project Setup & Environment `[COMPLETED]`

- Scaffolded project structure (`backend/` and `client/`).
- Configured Express server, CORS, Morgan logging, and Helmet security.
- Initialized Prisma and configured local PostgreSQL database.
- Created `GET /api/` health check endpoint.

---

## Phase 1 — Database Schema `[COMPLETED]`

- Configured complete PostgreSQL schema using Prisma:
  - Users, Categories, Products, Customers, Suppliers, Salesmen, SalesTargets.
  - ExpenseCategories, Expenses, StockMovements, Purchases, PurchaseItems.
  - Invoices, InvoiceItems, CustomerLedger, CustomerPayments.
  - SupplierLedger, SupplierPayments, SalesReturns, SalesReturnItems.
  - PurchaseReturns, PurchaseReturnItems.
- Seeded database with default categories, users, and expense options.

---

## Phase 2 — Auth & Core Middleware `[COMPLETED]`

- Configured JWT tokens, bcrypt password hashing, and cookie-based extraction.
- Developed authentication endpoints `/api/auth/login`, `/api/auth/register`, `/api/auth/logout`.
- Developed authorization middleware (`authorize('ADMIN', 'STAFF')`).

---

## Phase 3 — Master Data CRUD `[COMPLETED]`

- Full CRUD routes, controllers, and Zod validators for:
  - Product Categories, Products, Customers, Suppliers, Salesmen, Expense Categories.
- Setup pagination, text search, and active/inactive status filters.

---

## Phase 4 — Inventory Core (Stock Engine) `[COMPLETED]`

- Implemented atomic stock adjustments:
  `stockModel.adjustStock({ productId, quantity, type: 'IN'|'OUT', referenceType, referenceId, description, createdById }, tx)`
- Enforced concurrency checks to prevent inventory overselling (checking `stockQuantity >= -delta` during OUT movements).
- Manual adjustments routed through `adjustStock`.

---

## Phase 5 — Purchases & Returns `[COMPLETED]`

- **Purchases:** Ingests stock from suppliers, creates a `Purchase` record, triggers `adjustStock` (`IN`), logs a credit ledger row to `SupplierLedger`, and updates `Supplier.balance`.
- **Purchase Returns:** Deducts stock (`OUT`), registers returns, logs a debit ledger row, and reduces supplier balance.
- **Document Numbering:** Automatically generates sequential document numbers (e.g. `PUR-000001`, `PR-000001`).

---

## Phase 6 — Sales & Returns `[COMPLETED]`

- **Invoices (Cash/Credit):** Validates stock levels, creates `Invoice` and `InvoiceItem` entries (snapshotting `costPriceAtSale`), triggers `adjustStock` (`OUT`), records counter cash payments, and writes debits to the customer ledger for outstanding amounts.
- **Sales Returns:** Reverses stock levels (`IN`), writes credits to `CustomerLedger` to reduce outstanding customer balances, and enforces return bounds to prevent returning more than originally bought.
- **Document Numbering:** Automatically generates sequential document numbers (e.g. `INV-000001`, `SR-000001`).

---

## Phase 7 — Payments `[COMPLETED]`

- **Customer Payments:** Records payments, updates invoice paid statistics, sets states (`PAID`, `PARTIALLY_PAID`), and writes credits to the customer ledger. Overpayments beyond outstanding balances are rejected.
- **Supplier Payments:** Records settlements and logs debits to the supplier ledger to reduce outstanding balances.

---

## Phase 8 — Salesmen Targets & Expenses `[COMPLETED]`

- **Targets:**
  - `setTarget()`: Normalizes month values (e.g. `"2026-07"` -> `"2026-07-01T00:00:00.000Z"`) and performs upserts using compound unique index.
  - `getAchievement()`: Computes gross sales attributed to a salesman minus returned merchandise, compared against monthly goals.
- **Expenses:** Adds business expenses under active categories.

---

## Phase 9 — Reports & Dashboard `[COMPLETED]`

- **Dashboard:** Returns totals for today/week/month sales, receivables, payables, monthly expenses, net profits, active low stock levels (`stockQuantity <= lowStockLevel`), and top 5 products.
- **Reports:**
  - `salesByDay` & `purchasesByDay` grouped via database raw SQL.
  - `currentStockReport` & `lowStockReport` (valuing inventory at cost and selling prices).
  - `customerLedgerReport` showing customer receivables sorted into aging buckets (`0-30 days`, `31-60 days`, `60+ days`).
  - `profitReport`, `expenseReport` and `netProfitReport` displaying profit margins using snapshotted unit costs.

---

## Phase 10 — Frontend (React Client) `[COMPLETED]`

- Built React single-page application using Vite and Tailwind CSS with a premium Light Blue theme.
- Configured AuthContext for state tracking and dynamic role-based route guards wrapping layout views.
- **Core Interfaces:**
  - **Dashboard**: Interactive cards displaying sales, collections, and expenses metrics with Recharts line/bar trends.
  - **Master Data**: Full CRUD panels with text search and page controls for Products, Categories, Customers, Suppliers, and Salesmen.
  - **Inventory Adjustments**: Log physical stock audit corrections and inspect all inflows/outflows in chronological stock logs.
  - **Purchases & Returns**: Ingest supplier consignments line-by-line, calculate totals and discount reductions, and log purchase returns.
  - **Invoices (POS)**: Multi-product retail invoice generator validating stock limits in real-time, matching cash/credit customer types, and supporting 80mm thermal receipts alongside standard A4 print sheets.
  - **Payments**: Process customer collections and supplier settlements with built-in balance verification.
  - **Ledgers**: Chronological statement ledger streams for customer and supplier accounts showing debits, credits, and running statement balances.
  - **Reports**: P&L sheets (Gross profit, expenses category lists, net margins) and stock valuations.
  - **ForgotPassword**: Secure anonymous reset panel validating requests against `SUPERADMINKEY` before hashed update.
  - **Admin Panel**: Visible to ADMIN roles only, providing operator directories and password reset forms.

---

## Phase 11 — Hardening & Deployment `[TODO]`

- Setup client-side input validations using Formik/React Hook Form matching Zod backend boundaries.
- Configure PM2 or systemd to daemonize the Node process.
- Configure PostgreSQL to launch automatically as a Windows/system service.
- Automate scheduled local daily backups using `pg_dump`.
