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

---

## 5. Database Cleanup & Backup Utilities

We have built specific database utilities to support testing and operational maintenance:

### A. Database Cleanup (`scratch/clean-db.js`)
* **Purpose:** Safely wipes all user data in the database for clean-slate testing.
* **Mechanism:** Queries tables dynamically in the `public` schema (skipping the Prisma migrations system table) and runs a cascaded truncate query. It does *not* write any seed data or create random mock rows.
* **Usage:**
  ```bash
  cd backend
  node scratch/clean-db.js
  ```
* *Warning: After running this script, the database will be completely empty. You must register the first user manually via `POST /api/auth/register` (using the system's `REGISTRATION_SECRET` in `.env`) or via the client signup page before logging in.*

### B. Database Backup (`config/backup-db.js`)
* **Purpose:** Generates a standard SQL restore dump of the database.
* **Mechanism:** Pure JS query scanner that loops through tables, escapes values correctly (strings, decimals, nulls, dates), and wraps the script with constraint disable tags (`session_replication_role = 'replica'`) and sequence re-alignments.
* **CLI Usage:**
  ```bash
  cd backend
  node config/backup-db.js
  ```
  *Saves timestamped SQL files to `backend/backups/`.*
* **Web UI Integration:** Administrators can trigger this dynamically via the **Backup Database** button on the client dashboard. This calls the admin-restricted `GET /api/system/backup` endpoint, storing a backup file copy on the server in `backend/backups/` and returning the file to the browser as a direct download.

---

## 6. Local Deployment Guide

Follow these instructions to deploy the complete fullstack application on a single local computer:

### Step 1: Install System Prerequisites
1. **Node.js:** Install Node.js LTS (version 18 or above recommended).
2. **PostgreSQL:** Install PostgreSQL database (version 14 or above).
   * Ensure the PostgreSQL service is configured to run automatically on system boot.

### Step 2: Configure Backend Environment
1. In the `backend/` directory, create a `.env` file based on `.env.example`.
2. Configure your database connection string under `DATABASE_URL`:
   ```env
   DATABASE_URL="postgresql://<user>:<password>@localhost:5432/<db_name>?schema=public"
   ```
3. Set your system secrets:
   ```env
   PORT=3000
   CLIENT_URL=http://localhost:5173
   COOKIE_SECRET=YourSecretCookiePhraseHere
   JWT_SECRET=YourSecretTokenSigningPhraseHere
   REGISTRATION_SECRET=SuperSecretKeyForAddingUsers
   SUPERADMINKEY=SuperSecretAdminForgotKey
   ```

### Step 3: Run Database Migrations
Prisma requires syncing the database schema and generating the local client library:
1. Navigate to the `backend/` folder:
   ```bash
   cd backend
   ```
2. Install Node dependencies:
   ```bash
   npm install
   ```
3. Push the schema to the database (creates database tables and structures):
   ```bash
   npx prisma db push
   ```
4. Build the Prisma Client:
   ```bash
   npx prisma generate
   ```

### Step 4: Configure Frontend Environment
1. Navigate to the `client/` directory:
   ```bash
   cd ../client
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file (or verify configurations) mapping the backend URL:
   ```env
   VITE_API_URL=http://localhost:3000
   ```

### Step 5: Start Servers (Development vs Production Modes)

#### Option A: Running in Development Mode (For verification/testing)
1. **Start Backend Server:**
   ```bash
   cd backend
   npm run dev
   ```
2. **Start Frontend Client:**
   ```bash
   cd client
   npm run dev
   ```
   *Access the app at `http://localhost:5173`.*

#### Option B: Running in Production Mode (Recommended & Pre-configured for Local Client Deployment)
To deploy locally for a client to run smoothly on their PC as a single unified service:
1. **Build Frontend Assets:**
   Compile the React code into optimized HTML/JS/CSS assets:
   ```bash
   cd client
   cmd.exe /c npm run build  # On Windows, use CMD if PowerShell script running is restricted
   ```
   *This creates the `client/dist` folder.*
2. **Co-Serving Architecture:**
   The Express backend is pre-configured to automatically check if `client/dist` exists. If it does, Express will serve it statically. Any non-API route hits will automatically fall back to serving `client/dist/index.html` to support React Router client-side routes.
3. **Run Backend & Serve Frontend via PM2:**
   Since Express handles both the API and the React files on a single port (`3000`), you only need to run/daemonize **one process** (the Node.js backend). Run using PM2 to ensure the system starts on reboot and auto-recovers from crashes:
   ```bash
   npm install -g pm2
   cd backend
   pm2 start app.js --name "ims-fullstack"
   pm2 save
   pm2 startup
   ```
4. **Access the Application:**
   * Open the browser and visit: `http://localhost:3000`
   * Register the initial Administrator user utilizing the signup form (inputting the `REGISTRATION_SECRET` token set in your backend `.env` file).
5. **No CORS Issues:**
   Because both frontend files and API calls originate from the same hostname and port (`http://localhost:3000`), all cross-origin restrictions are naturally bypassed, making local setups extremely stable.
