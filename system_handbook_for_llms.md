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

### Non-Negotiable Core Rules & Phase 12 Invariants
1. **Single Fundamental Stock Unit (Pieces Only):** 
   - All product quantities across the entire system (inventory, invoices, purchases, returns, adjustments) are measured and stored as **integer pieces**.
   - `Product.piecesPerCarton` is strictly a *display-only memory aid* for counter staff doing manual carton conversions; it is **never** used in calculations.
2. **Operational Caches vs. Frozen Historical Facts (Phase 12 Core Invariant):**
   - `Product.stockQuantity` and `Product.weightedAvgCost` are **live operational caches**. They reflect current on-hand stock and pool value.
   - Every transaction line (`InvoiceItem.costPriceAtSale`, `PurchaseItem.unitCost`, `SalesReturnItem`, `PurchaseReturnItem`) and `GLJournalEntry` is a **frozen historical fact**. It never changes after posting and is never re-read from `Product`.
   - Historical P&L and financial reports query **only** frozen transaction lines and GL journal entries. Change today's WAC $\rightarrow$ yesterday's profit NEVER changes.
3. **3-Layer Architecture:**
   - `routes/`: Endpoint mapping & Zod request body/query validation.
   - `controllers/`: HTTP parsing, status codes, and standard envelope responses (`{ type: "success"|"error", data, message }`).
   - `models/`: Database access, Prisma queries, raw SQL, and transaction orchestrations (`prisma.$transaction`).
   - *Rule:* **No business rule execution or database calls inside controllers or routes.** No separate service/repository layers.
4. **Transaction Safety & Atomicity:**
   - Every multi-table state mutation (creating an invoice, deducting stock, updating customer ledger, posting GL journal entries) **must** run inside a database transaction (`prisma.$transaction`). Partial commits are strictly prohibited.
5. **Single Stock Engine (`adjustStock`) & Row Locking:**
   - All inventory increases (`IN`) and decreases (`OUT`) MUST pass through `stockModel.adjustStock()` in `models/stock-model.js`.
   - Transactional mutations execute database row-level locking (`SELECT ... FOR UPDATE`) on `Product`, `Invoice`, and `Customer` rows prior to reading balances or stock levels.
6. **Ledger & Document Immutability:**
   - `CustomerLedger`, `SupplierLedger`, `GLJournalEntry`, and posted documents are **append-only**.
   - No hard `DELETE` or financial `UPDATE` operations once posted. Corrections use reversing entries/documents (`referenceType: CORRECTION`).
   - Documents follow a strict state machine: `documentStatus: DRAFT | POSTED | VOIDED`.

---

## 2. Core Business Accounting Engines

### A. Customer & Supplier Balance Conventions
- **Customer Balance (`Customer.balance`):** Always derived from `Σ(CustomerLedger.debit) - Σ(CustomerLedger.credit)`.
  - **Positive (`balance > 0`):** Customer owes us money (accounts receivable).
  - **Negative (`balance < 0`):** We owe customer money (store credit / credit return / advance payment).
  - **Zero (`balance = 0`):** Account is fully settled.
- **Supplier Balance (`Supplier.balance`):** Always derived from `Σ(SupplierLedger.credit) - Σ(SupplierLedger.debit)`.
  - **Positive (`balance > 0`):** We owe supplier money (accounts payable).
  - **Negative (`balance < 0`):** Supplier owes us money (purchase return / advance payment).
  - **Zero (`balance = 0`):** Account is fully settled.

### B. Purchase Return WAC & Variance Mechanics (Phase 12)
- Purchase returns **never re-derive WAC** for remaining stock. Remaining `Product.weightedAvgCost` per unit is untouched.
- Physical stock reduction is valued at **Current Pool WAC**:
  $$\text{Inventory Delta} = -(\text{returnedQty} \times \text{currentPoolWAC})$$
- Vendor payable reduction is valued at **Agreed Refund Rate**:
  $$\text{Payable Delta} = -(\text{returnedQty} \times \text{agreedRefundRate})$$
- The difference is posted to **`5100 - Purchase Return Variance`** (Gain/Loss GL account):
  $$\text{Variance Delta} = \text{Payable Delta} - \text{Inventory Delta}$$

### C. Sales Returns & Transport Expense Rules
- Registered customer returns (`invoice.customerId` present) are processed as `CREDIT` returns into `CustomerLedger`.
- Walk-in customer returns (`invoice.customerId` is null) are processed automatically as `CASH` returns.
- Transport discount incurred at invoice creation is an incurred transport expense and is **never** reversed or deducted from customer return credit/refund during sales returns.

### D. General Ledger (GL) Engine & Chart of Accounts
P&L and Balance Sheet reports are calculated from posted **`GLJournalEntry`** rows:

| Code | Account Name | Account Type |
|---|---|---|
| 1000 | Cash / Bank | ASSET |
| 1100 | Accounts Receivable | ASSET |
| 1300 | Inventory Asset | ASSET |
| 1400 | Vendor Advances | ASSET |
| 2000 | Accounts Payable | LIABILITY |
| 2100 | Customer Deposits / Advances | LIABILITY |
| 4000 | Sales Revenue | INCOME |
| 4100 | Sales Returns | CONTRA |
| 5000 | Cost of Goods Sold | EXPENSE |
| 5100 | Purchase Return Variance | EXPENSE |
| 5200 | Inventory Shrinkage / Write-down | EXPENSE |
| 6000 | Operating Expenses | EXPENSE |
| 6100 | Bad Debt Expense | EXPENSE |

---

## 3. Database Schema Overview (Prisma Models)

```prisma
enum Role { ADMIN STAFF }
enum MovementType { IN OUT }
enum ReferenceType { PURCHASE INVOICE SALES_RETURN PURCHASE_RETURN ADJUSTMENT PAYMENT CORRECTION DEPOSIT WRITE_OFF }
enum SaleType { CASH CREDIT }
enum InvoiceStatus { UNPAID PARTIALLY_PAID PAID }
enum DocumentStatus { DRAFT POSTED VOIDED }
enum CustomerPaymentType { CASH CREDIT_APPLICATION CASH_REFUND }
enum SupplierPaymentType { NORMAL ADVANCE }
enum SalesReturnRefundType { CASH CREDIT }
enum GLAccountType { ASSET LIABILITY EQUITY INCOME EXPENSE CONTRA }

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
  costPrice       Decimal @db.Decimal(12, 4) // Reference cost
  sellingPrice    Decimal @db.Decimal(12, 2)
  weightedAvgCost Decimal @default(0) @db.Decimal(12, 4) // System-calculated live WAC pool
  stockQuantity   Int     @default(0) // Quantity in pieces
  lowStockLevel   Int     @default(0)
  piecesPerCarton Int?    // Display-only helper
  isActive        Boolean @default(true)
}

model Customer {
  id          Int      @id @default(autoincrement())
  name        String
  phone       String?
  address     String?
  balance     Decimal  @default(0) @db.Decimal(12, 2) // Derived: owe us (>0), store credit (<0)
  creditLimit Decimal? @default(0) @db.Decimal(12, 2)
  isActive    Boolean  @default(true)
}

model Supplier {
  id       Int     @id @default(autoincrement())
  name     String
  phone    String?
  address  String?
  balance  Decimal @default(0) @db.Decimal(12, 2) // Derived: we owe (>0), they owe (<0)
  isActive Boolean @default(true)
}

model Invoice {
  id                Int            @id @default(autoincrement())
  invoiceNo         String         @unique // INV-XXXXXX
  customerId        Int?           // null = walk-in customer
  salesmanId        Int?
  saleType          SaleType       @default(CASH)
  subtotal          Decimal        @db.Decimal(12, 2)
  discount          Decimal?       @default(0) @db.Decimal(12, 2)
  transportDiscount Decimal?       @default(0) @db.Decimal(12, 2)
  total             Decimal        @db.Decimal(12, 2)
  paidAmount        Decimal        @default(0) @db.Decimal(12, 2)
  creditApplied     Decimal        @default(0) @db.Decimal(12, 2)
  returnedAmount    Decimal        @default(0) @db.Decimal(12, 2)
  balanceDue        Decimal        @default(0) @db.Decimal(12, 2)
  status            InvoiceStatus  @default(UNPAID)
  documentStatus    DocumentStatus @default(POSTED)
}

model InvoiceItem {
  id              Int     @id @default(autoincrement())
  invoiceId       Int
  productId       Int
  quantity        Int
  unitPrice       Decimal @db.Decimal(12, 2)
  costPriceAtSale Decimal @db.Decimal(12, 4) // Frozen historical WAC snapshot at second of sale
  totalPrice      Decimal @db.Decimal(12, 2)
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

model PurchaseReturn {
  id          Int      @id @default(autoincrement())
  returnNo    String?  @unique // PR-XXXXXX
  supplierId  Int
  purchaseId  Int
  totalAmount Decimal  @db.Decimal(12, 2)
  reason      String?
}

model CustomerLedger {
  id            Int           @id @default(autoincrement())
  customerId    Int
  debit         Decimal       @default(0) @db.Decimal(12, 2)
  credit        Decimal       @default(0) @db.Decimal(12, 2)
  balance       Decimal       @db.Decimal(12, 2) // Running balance snapshot
  referenceType ReferenceType
  referenceId   Int
}

model SupplierLedger {
  id            Int           @id @default(autoincrement())
  supplierId    Int
  debit         Decimal       @default(0) @db.Decimal(12, 2)
  credit        Decimal       @default(0) @db.Decimal(12, 2)
  balance       Decimal       @db.Decimal(12, 2)
  referenceType ReferenceType
  referenceId   Int
}

model GLAccount {
  id    Int           @id @default(autoincrement())
  code  String        @unique // "1000", "1300", "5000", etc.
  name  String
  type  GLAccountType
}

model GLJournalEntry {
  id            Int       @id @default(autoincrement())
  entryDate     DateTime  @default(now())
  accountId     Int
  account       GLAccount @relation(fields: [accountId], references: [id])
  debit         Decimal   @db.Decimal(12, 2)
  credit        Decimal   @db.Decimal(12, 2)
  referenceType String    // "INVOICE", "PURCHASE", "SALES_RETURN", "PURCHASE_RETURN", "PAYMENT", "CORRECTION"
  referenceId   Int
  description   String
  createdById   Int
  createdAt     DateTime  @default(now())
}

model CustomerDeposit {
  id            Int      @id @default(autoincrement())
  customerId    Int
  amount        Decimal  @db.Decimal(12, 2)
  appliedAmount Decimal  @default(0) @db.Decimal(12, 2)
  createdAt     DateTime @default(now())
}

model CreditNote {
  id         Int      @id @default(autoincrement())
  customerId Int
  invoiceId  Int?
  amount     Decimal  @db.Decimal(12, 2)
  reason     String?
  createdAt  DateTime @default(now())
}

model DebitNote {
  id         Int      @id @default(autoincrement())
  supplierId Int
  purchaseId Int?
  amount     Decimal  @db.Decimal(12, 2)
  reason     String?
  createdAt  DateTime @default(now())
}

model BadDebtWriteOff {
  id        Int      @id @default(autoincrement())
  invoiceId Int
  amount    Decimal  @db.Decimal(12, 2)
  reason    String
  createdAt DateTime @default(now())
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
| `/api/sales-return` | POST | Create Sales Return | `{ invoiceId, items: [{productId, quantity}] }` |
| `/api/purchase-return` | POST | Create Purchase Return | `{ supplierId, purchaseId, items: [{productId, quantity}] }` |
| `/api/payment/customer` | POST | Customer Payment | `{ customerId, amount, allocations: [...] }` |
| `/api/payment/customer/refund-credit` | POST | Cash Refund of Credit | `{ customerId, amount, description }` |
| `/api/gl/trial-balance` | GET | GL Trial Balance | `?from=YYYY-MM-DD&to=YYYY-MM-DD` |
| `/api/gl/profit-loss` | GET | Immutable GL P&L | `?from=YYYY-MM-DD&to=YYYY-MM-DD` |
| `/api/gl/journal-entries` | GET | GL Audit Trail | `?referenceType=...&page=1&limit=50` |
| `/api/gl/customer-deposit` | POST | Post Customer Deposit | `{ customerId, amount, description }` |
| `/api/gl/credit-note` | POST | Issue Credit Note | `{ customerId, invoiceId, amount, reason }` |
| `/api/gl/debit-note` | POST | Issue Debit Note | `{ supplierId, purchaseId, amount, reason }` |
| `/api/gl/bad-debt-writeoff` | POST | Write Off Bad Debt | `{ invoiceId, reason }` |
| `/api/report/dashboard` | GET | Executive Dashboard | Returns sales totals, receivables, payables, GL net profit, low stock |
| `/api/system/backup` | GET | Download SQL Dump | Admin-only route to download database backup |
| `/api/system/accounting-periods` | GET | List Period Locks | List all accounting periods and closed statuses |
| `/api/system/accounting-periods` | POST | Create Period | `{ name, startDate, endDate }` |
| `/api/system/accounting-periods/:id/lock` | PUT | Lock/Close Period | Admin-only route to close/lock fiscal period |
| `/api/system/accounting-periods/:id/unlock` | PUT | Re-open Period | Admin override to unlock fiscal period |

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
  - `AccountingPeriods.jsx`: Fiscal calendar management & period locking controls.
  - `GeneralLedger.jsx`: Double-entry Trial Balance, frozen P&L, GL Journal Audit Trail, Customer Prepayments/Deposits, Credit/Debit Notes, and Bad Debt Write-offs.
  - `Customers.jsx` & `Suppliers.jsx`: Accounts directories with instant balance filtering (`Owes Us`, `We Owe`, `Zero`).
  - `Reports.jsx`: Financial GL P&L sheets, ledger statements, and stock valuation audits.

### Backend (`backend/`)
- **Runtime:** Node.js (v18+) + Express 5
- **Database:** PostgreSQL (v14+) + Prisma ORM (v7)
- **Validation:** Zod (`zod`)
- **Auth:** JSON Web Tokens (`jsonwebtoken`) + Bcrypt (`bcrypt`)
- **Scripts (`backend/scratch/`):**
  - `audit_reconciliation.js`: System audit script checking inventory, customer/supplier ledgers, and GL trial balance.
  - `clean-db.js`: Database wiping script.
  - `backup-db.js`: SQL dump generator.

---

## 6. How to Extend / Modify This System

If you are an LLM or Developer extending this system:
1. **Always edit `backend/models/` for database logic.** Never place database calls in controllers.
2. **Always wrap multi-table updates in `prisma.$transaction`.**
3. **Always route inventory changes through `stockModel.adjustStock`.**
4. **Never introduce non-piece units.** Keep all quantities as integer pieces.
5. **Never mutate WAC during purchase returns.** Reduce stock at current pool WAC and post variances to GL `5100`.
6. **Never edit or delete posted ledger/GL rows.** Insert reversing entries (`referenceType: CORRECTION`).
7. **Preserve balance conventions:** `Customer.balance > 0` = customer owes us; `Supplier.balance > 0` = we owe supplier.
