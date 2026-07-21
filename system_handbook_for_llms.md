# SameerTraderz FMCG Distribution Inventory & Accounts System — LLM Context & Technical Reference Handbook

> **LLM CONTEXT & SOURCE OF TRUTH**
> 
> This document provides a complete technical and functional specification for the **SameerTraderz Inventory & Accounts Management System**. Any Large Language Model (LLM) reading this file will gain full understanding of what we are building, the underlying architecture, database structures, business logic, transaction engines, and API interfaces.

---

## 1. System Overview & Core Philosophy

### Business Context
- **Business Type:** FMCG (Fast-Moving Consumer Goods) wholesale distribution (diapers, tissues, wipes, soaps, hygiene products).
- **Users:** Internal Admin and Staff operators only (no public customer portal).
- **Currency:** Pakistani Rupee (PKR).
- **Deployment:** Single-site desktop/server local deployment running PostgreSQL, Node.js/Express, and React/Vite.

### Non-Negotiable Core Rules
1. **Single Fundamental Stock Unit (Pieces Only):** 
   - All product quantities across the entire system (inventory, invoices, purchases, returns, adjustments) are measured and stored as **integer pieces**.
   - `Product.piecesPerCarton` is strictly a *display-only memory aid* for counter staff doing manual carton conversions; it is **never** used in calculations.
2. **3-Layer Architecture:**
   - `routes/`: Endpoint mapping & Zod request body/query validation.
   - `controllers/`: HTTP parsing, status codes, and standard envelope responses (`{ type: "success"|"error", data, message }`).
   - `models/`: Database access, Prisma queries, raw SQL, and transaction orchestrations (`prisma.$transaction`).
   - *Rule:* **No business rule execution or database calls inside controllers or routes.** No separate service/repository layers.
3. **Transaction Safety:**
   - Every multi-table state mutation (e.g. creating an invoice + deducting stock + updating customer ledger) **must** run inside a database transaction (`prisma.$transaction`). Partial commits are strictly prohibited.
4. **Single Stock Engine (`adjustStock`):**
   - **All** inventory increases (`IN`) and decreases (`OUT`) MUST pass through `stockModel.adjustStock()` inside `models/stock-model.js`.
   - Outward stock movements use database row-level locking (`FOR UPDATE`) and conditional checks (`stockQuantity >= -delta`) to prevent overselling under concurrent requests.

---

## 2. Core Business Entities & Ledger Mechanics

### A. Customer & Supplier Balance Conventions
- **Customer Balance (`Customer.balance`):**
  - **Positive (`balance > 0`):** Customer owes us money (accounts receivable).
  - **Negative (`balance < 0`):** We owe customer money (store credit / credit return / advance payment).
  - **Zero (`balance = 0`):** Account is fully settled.
- **Supplier Balance (`Supplier.balance`):**
  - **Positive (`balance > 0`):** We owe supplier money (accounts payable).
  - **Negative (`balance < 0`):** Supplier owes us money (purchase return / advance payment).
  - **Zero (`balance = 0`):** Account is fully settled.

### B. Sales Returns & Store Credit Workflow
- **Shift to Credit Returns:**
  - Sales returns for registered customers (`invoice.customerId` is present) are **always** processed as `CREDIT` returns.
  - The return amount credits the `CustomerLedger`, reducing what the customer owes (or increasing their store credit / negative balance).
  - Walk-in customer returns (`invoice.customerId` is null) have no customer ledger and are processed automatically as `CASH` returns.
- **Refunding Store Credit as Cash:**
  - When a customer has a negative balance (we owe them money from store credit returns) and wants cash back, staff call `POST /api/payment/customer/refund-credit` (`paymentModel.refundCustomerCreditBalance`).
  - This checks available credit, posts a `DEBIT` to `CustomerLedger` (raising balance back toward 0), and creates a `CustomerPayment` record with `paymentType = CASH_REFUND`.

### C. Balance Filtering
- **Customer Directory (`GET /api/customer?balanceFilter=...`):**
  - `oweUs`: Returns customers with `balance > 0` (those who owe us money).
  - `weOwe`: Returns customers with `balance < 0` (those with store credit).
  - `zero`: Returns customers with `balance = 0`.
- **Supplier Directory (`GET /api/supplier?balanceFilter=...`):**
  - `weOwe`: Returns suppliers with `balance > 0` (those we owe money to).
  - `oweUs`: Returns suppliers with `balance < 0` (those who owe us).
  - `zero`: Returns suppliers with `balance = 0`.

### D. COGS & Profit Snapshotting
- Profit calculations do **not** use current product cost. Instead, `InvoiceItem.costPriceAtSale` snapshots the product's Weighted Average Cost (`Product.weightedAvgCost`) at the exact second of sale.
- This ensures historical profit reports remain 100% accurate even if vendor costs change months later.

---

## 3. Database Schema Overview (Prisma Models)

```prisma
enum Role { ADMIN STAFF }
enum MovementType { IN OUT }
enum ReferenceType { PURCHASE INVOICE SALES_RETURN PURCHASE_RETURN ADJUSTMENT PAYMENT }
enum SaleType { CASH CREDIT }
enum InvoiceStatus { UNPAID PARTIALLY_PAID PAID }
enum CustomerPaymentType { CASH CREDIT_APPLICATION CASH_REFUND }
enum SupplierPaymentType { NORMAL ADVANCE }
enum SalesReturnRefundType { CASH CREDIT }

model User {
  id        Int      @id @default(autoincrement())
  username  String   @unique
  password  String   // Bcrypt hash
  role      Role     @default(STAFF)
  isActive  Boolean  @default(true)
}

model Product {
  id              Int     @id @default(autoincrement())
  name            String
  barcode         String? @unique
  sku             String? @unique
  categoryId      Int
  costPrice       Decimal @db.Decimal(12, 2) // Reference cost
  sellingPrice    Decimal @db.Decimal(12, 2)
  weightedAvgCost Decimal @default(0) @db.Decimal(12, 4) // System-calculated WAC
  stockQuantity   Int     @default(0) // Quantity in pieces
  lowStockLevel   Int     @default(0)
  piecesPerCarton Int?    // Display-only display helper
  isActive        Boolean @default(true)
}

model Customer {
  id       Int     @id @default(autoincrement())
  name     String
  phone    String?
  address  String?
  balance  Decimal @default(0) @db.Decimal(12, 2) // Positive = owes us, Negative = store credit
  isActive Boolean @default(true)
}

model Supplier {
  id       Int     @id @default(autoincrement())
  name     String
  phone    String?
  address  String?
  balance  Decimal @default(0) @db.Decimal(12, 2) // Positive = we owe them
  isActive Boolean @default(true)
}

model Invoice {
  id                Int           @id @default(autoincrement())
  invoiceNo         String        @unique // INV-XXXXXX
  customerId        Int?          // null = walk-in customer
  salesmanId        Int?
  saleType          SaleType      @default(CASH)
  subtotal          Decimal       @db.Decimal(12, 2)
  discount          Decimal?      @default(0) @db.Decimal(12, 2)
  transportDiscount Decimal?      @default(0) @db.Decimal(12, 2)
  total             Decimal       @db.Decimal(12, 2)
  paidAmount        Decimal       @default(0) @db.Decimal(12, 2)
  creditApplied     Decimal       @default(0) @db.Decimal(12, 2)
  returnedAmount    Decimal       @default(0) @db.Decimal(12, 2)
  balanceDue        Decimal       @default(0) @db.Decimal(12, 2)
  status            InvoiceStatus @default(UNPAID)
}

model SalesReturn {
  id          Int                   @id @default(autoincrement())
  returnNo    String?               @unique // SR-XXXXXX
  customerId  Int?
  invoiceId   Int
  totalAmount Decimal               @db.Decimal(12, 2)
  refundType  SalesReturnRefundType @default(CREDIT)
  reason      String?
}

model CustomerLedger {
  id            Int           @id @default(autoincrement())
  customerId    Int
  debit         Decimal       @default(0) @db.Decimal(12, 2) // Increases balance (credit sale / cash refund)
  credit        Decimal       @default(0) @db.Decimal(12, 2) // Decreases balance (payment / sales return)
  balance       Decimal       @db.Decimal(12, 2) // Running balance snapshot
  referenceType ReferenceType
  referenceId   Int
}

model CustomerPayment {
  id          Int                 @id @default(autoincrement())
  customerId  Int
  amount      Decimal             @db.Decimal(12, 2)
  paymentType CustomerPaymentType @default(CASH)
  description String?
}
```

---

## 4. Primary API Endpoints Directory

All routes require JWT authentication (`Authorization` header / httpOnly cookie), except `/api/auth/login`.

| Endpoint | Method | Description | Key Query / Body Parameters |
|---|---|---|---|
| `/api/auth/login` | POST | Login operator | `{ username, password }` |
| `/api/product` | GET | List products | `?search=...&categoryId=...&page=1&limit=10` |
| `/api/customer` | GET | List customers | `?search=...&isActive=true&balanceFilter=oweUs\|weOwe\|zero` |
| `/api/supplier` | GET | List suppliers | `?search=...&isActive=true&balanceFilter=weOwe\|oweUs\|zero` |
| `/api/invoice` | POST | Create Invoice | `{ customerId, saleType, items: [{productId, quantity, unitPrice}] }` |
| `/api/sales-return` | POST | Create Sales Return | `{ invoiceId, items: [{productId, quantity}] }` *(auto-derives refundType)* |
| `/api/payment/customer` | POST | Customer Payment | `{ customerId, amount, allocations: [...] }` |
| `/api/payment/customer/refund-credit` | POST | Cash Refund of Credit | `{ customerId, amount, description }` |
| `/api/payment/customer/allocate` | POST | Allocate Advance Credit | `{ customerPaymentId, allocations: [...] }` |
| `/api/report/dashboard` | GET | Executive Dashboard | Returns sales totals, receivables, payables, net profit, low stock count |
| `/api/system/backup` | GET | Download SQL Dump | Admin-only route to download database backup |

---

## 5. Technology Stack & Directory Layout

### Frontend (`client/`)
- **Framework:** React 19 + Vite 8
- **Styling:** Vanilla CSS + Tailwind CSS (v4) with Dark Mode support & HSL themes
- **Icons:** Lucide React (`lucide-react`)
- **Charts:** Recharts (`recharts`)
- **Key Views:**
  - `Dashboard.jsx`: Executive analytics with revenue trends & quick stats.
  - `Invoices.jsx`: Point-of-Sale invoice generator with thermal receipt (80mm) & A4 print sheets.
  - `Returns.jsx`: Sales & Purchase Returns register with dynamic Store Credit status badges.
  - `Payments.jsx`: Customer collections, supplier settlements, and store credit cash refunds.
  - `Customers.jsx` & `Suppliers.jsx`: Accounts directories with instant balance filtering (`Owes Us`, `We Owe`, `Zero`).
  - `Reports.jsx`: Financial P&L sheets, ledger statements, and stock valuation audits.

### Backend (`backend/`)
- **Runtime:** Node.js (v18+) + Express 5
- **Database:** PostgreSQL (v14+) + Prisma ORM (v7)
- **Validation:** Zod (`zod`)
- **Auth:** JSON Web Tokens (`jsonwebtoken`) + Bcrypt (`bcrypt`)
- **Scripts (`backend/scratch/`):**
  - `audit_reconciliation.js`: Read-only system audit script to check inventory/ledger drift.
  - `clean-db.js`: Database wiping script.
  - `backup-db.js`: SQL dump generator.

---

## 6. How to Extend / Modify This System

If you are an LLM or Developer extending this system:
1. **Always edit `backend/models/` for database logic.** Never place database calls in controllers.
2. **Always wrap multi-table updates in `prisma.$transaction`.**
3. **Always route inventory changes through `stockModel.adjustStock`.**
4. **Never introduce non-piece units.** Keep all quantities as integer pieces.
5. **Preserve balance conventions:** `Customer.balance > 0` = customer owes us; `Supplier.balance > 0` = we owe supplier.
