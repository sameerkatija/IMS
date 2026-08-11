# SameerTraderz — Phase 12: GL-Grade Accounting Redesign

**Purpose of this document:** merge the Master Plan (Phases 0–11, completed) with the architecture review's findings, resolve them into one buildable spec, and give you the exact schema + algorithm changes needed so that **posting a new transaction can never change the result of a past report.**

This document is additive to `inventory-system-master-plan.md`. It does not repeat Phases 0–11; it defines Phase 12 onward.

---

## 1. The core invariant (read this first)

> **Change today's WAC → yesterday's profit changes. That must never happen.**

This happens today because your reports (and possibly `adjustStock`) read `Product.weightedAvgCost` — a value that is overwritten on every purchase — instead of reading a **frozen value written once, at posting time, on the transaction row itself.**

The fix has one shape, applied everywhere:

- `Product.stockQuantity` and `Product.weightedAvgCost` are **live operational caches**. They tell you "what do I have and what is it worth *right now*." They are correct for **today's** balance sheet.
- Every transaction line (`InvoiceItem.costPriceAtSale`, `PurchaseItem.unitCost`, `SalesReturnItem`, `PurchaseReturnItem`) is a **frozen historical fact**. It never changes after posting, and it never gets re-read from `Product`.
- Reports for **any past period** query only the frozen fields on transaction lines (or GL journal entries — see §4). They never join to live `Product` fields for anything except "current stock on hand right now" widgets.

Once you enforce that split everywhere, retroactive drift becomes structurally impossible — not "unlikely," impossible, because the report has no code path that reads a live field for a historical number.

---

## 2. Fixing the specific corruption: Purchase Return WAC

### What's broken
`purchase-return-model.js` currently does:

```
newWAC = (currentQty × currentWAC − returnedQty × originalPurchaseCost) / (currentQty − returnedQty)
```

This is only valid if none of that batch has sold. The moment any of it sold, `originalPurchaseCost` is no longer a value that exists in the pool — the pool already blended it away. Subtracting it a second time either double-counts the discount or drives the remaining pool value negative, exactly as the review's worked example shows (10 pcs left, pool value goes to **−$250**).

### The fix
Purchase returns **never re-derive WAC** for the remaining stock. Per-unit WAC of what's left is untouched. Instead:

1. **Inventory Asset** is reduced by `returnedQty × currentPoolWAC` (not original cost).
2. **Accounts Payable / Supplier balance** is reduced by `returnedQty × agreedRefundRate` (whatever the supplier actually credits you — this can differ from both original cost and current WAC).
3. The **difference** between those two numbers is not lost — it posts to a `PurchaseReturnVariance` account (gain or loss). It is real: either the supplier gave you a better/worse refund than the stock is currently worth on your books.
4. Remaining `Product.weightedAvgCost` for that item is **unchanged**. Only `stockQuantity` drops by `returnedQty`.

```
adjustStock({ type: 'OUT', quantity: returnedQty })   // uses CURRENT pool WAC, doesn't touch it
inventoryDelta   = -(returnedQty * currentPoolWAC)
payableDelta     = -(returnedQty * agreedRefundRate)
varianceDelta    =  payableDelta - inventoryDelta   // signed, can be + or -
```

This can never go negative for the *remaining* pool, because you're not subtracting anything from the pool's per-unit cost — you're only removing units at the cost they already sit at.

---

## 3. Fixing discounts (the other quiet corruptor)

Your current issue almost certainly stems from one of these three mistakes — check `invoice-model.js` for all three:

1. **Discount applied to unit price before storing `costPriceAtSale`.** Never let a customer-facing discount touch the *cost* side. Discount reduces `Invoice.total` / `InvoiceItem.lineTotal` (revenue side) only. `costPriceAtSale` is pulled from `Product.weightedAvgCost` untouched by any discount logic — COGS doesn't care what you charged the customer.
2. **Line-level rounding drift.** If you allocate an invoice-level discount % across N line items, `Σ(line discounts)` must be forced to equal the header discount exactly — put the rounding remainder on the **last line item**, never split it evenly and hope it adds up. Do this in integer cents (paisas), not floats:
   ```
   lineDiscount[i] = round(header.discountTotal * lineTotal[i] / invoiceSubtotal)   // for i = 1..N-1
   lineDiscount[N] = header.discountTotal - Σ(lineDiscount[1..N-1])                  // forces exact match
   ```
3. **Return bound checked against post-discount or pre-discount quantity inconsistently.** Sales return caps must compare against the *original invoice line quantity*, and refund at the *original post-discount unit price* — never recompute a "discounted price" fresh at return time, or a subsequent price change corrupts the refund.

Store money as `Decimal(12,2)` (already in your plan) and cost/WAC as `Decimal(12,4)` — 2 decimal places isn't enough precision for cost-per-piece math to survive thousands of transactions without cent drift.

---

## 4. The General Ledger engine (this is what makes history permanent)

Add one new pair of tables. This is the single biggest structural fix — it moves P&L from "computed live by summing sub-ledgers" to "computed by summing frozen journal rows."

```prisma
model GLAccount {
  id        Int      @id @default(autoincrement())
  code      String   @unique   // "1300", "5000", etc.
  name      String
  type      GLAccountType      // ASSET | LIABILITY | EQUITY | INCOME | EXPENSE | CONTRA
}

model GLJournalEntry {
  id             Int       @id @default(autoincrement())
  entryDate      DateTime  @default(now())
  accountId      Int
  account        GLAccount @relation(fields: [accountId], references: [id])
  debit          Decimal   @db.Decimal(12, 2)   // one of debit/credit is 0
  credit         Decimal   @db.Decimal(12, 2)
  referenceType  String    // "INVOICE" | "PURCHASE" | "SALES_RETURN" | "PURCHASE_RETURN" | "PAYMENT" | "CORRECTION" | ...
  referenceId    Int
  description    String
  createdById    Int
  createdAt      DateTime  @default(now())
  // NO updatedAt. NO update/delete allowed at the application layer, ever.
}
```

Minimum chart of accounts to start (matches the review, tuned to your business):

| Code | Account | Type |
|---|---|---|
| 1000 | Cash / Bank | Asset |
| 1100 | Accounts Receivable | Asset |
| 1300 | Inventory Asset | Asset |
| 1400 | Vendor Advances (supplier prepayments) | Asset |
| 2000 | Accounts Payable | Liability |
| 2100 | Customer Deposits / Advances | Liability |
| 4000 | Sales Revenue | Income |
| 4100 | Sales Returns | Contra-Income |
| 5000 | Cost of Goods Sold | Expense |
| 5100 | Purchase Return Variance | Expense/Income (either sign) |
| 5200 | Inventory Shrinkage / Write-down | Expense |
| 6000 | Operating Expenses | Expense |
| 6100 | Bad Debt Expense | Expense |

Every posting model function (invoice, purchase, sales return, purchase return, payment, expense) writes its normal rows **plus** the matching GL rows, inside the **same `prisma.$transaction`**. If GL rows fail to write, the whole transaction rolls back — no partial states.

**P&L for any date range becomes:**
```
Net Sales     = Σcredit(4000) − Σdebit(4100)                         [range-filtered by entryDate]
COGS          = Σdebit(5000) − Σcredit(5000)
Gross Profit  = Net Sales − COGS + Σcredit(5100) − Σdebit(5100)
Net Profit    = Gross Profit − Σdebit(6000) − Σdebit(6100)
```
This can never move once posted, because it sums rows with a real `entryDate` and nothing ever mutates a row after insert. Run it in January, run it again in July — same numbers, forever. That's the guarantee you're asking for.

---

## 5. Ledger and document immutability (append-only, no exceptions)

Apply to `CustomerLedger`, `SupplierLedger`, `GLJournalEntry`, and posted `Invoice` / `Purchase` rows:

- **No `UPDATE`, no `DELETE`** on any of these once a row exists (except non-financial metadata like a printed/emailed flag).
- Enforce this in two layers, not just app discipline:
  1. Prisma/service layer: don't expose update/delete methods for these models at all.
  2. Postgres trigger (`BEFORE UPDATE OR DELETE ... RAISE EXCEPTION`) on the ledger tables, so a stray script or future dev can't bypass the app layer.
- **Correction mechanism**: to fix a wrong entry, insert a reversing row (`referenceType: 'CORRECTION'`) that cancels it, then insert the correct row. The mistake stays visible in the trail — that's a feature, not a mess.
- **Invoices/Purchases get a state machine**: `DRAFT → POSTED → VOIDED`. Only `DRAFT` can be edited or hard-deleted. `POSTED` can only move to `VOIDED` via a reversing document (new `SR-`/`PR-` style credit doc that references the original), never a raw delete. Add a `status` column now if you don't have one; default existing rows to `POSTED`.

---

## 6. New first-class entities (stop faking these with dummy returns)

You're currently at risk of staff creating fake sales returns to zero out a bad debt, or negative balances to represent an advance — both corrupt stock counts. Add these four models instead:

```prisma
model CustomerDeposit {   // customer paid before any invoice exists
  id, customerId, amount, referenceType "DEPOSIT", createdAt, appliedAmount (running total allocated)
}
model CreditNote {        // formal non-inventory rebate/adjustment, not tied to a physical return
  id, customerId, invoiceId?, amount, reason, createdAt
}
model DebitNote {         // supplier owes you for damage/delay, bill not yet adjusted
  id, supplierId, purchaseId?, amount, reason, createdAt
}
model BadDebtWriteOff {   // invoice marked uncollectible
  id, invoiceId, amount, reason, createdAt
  // Invoice.status -> 'WRITTEN_OFF'; posts Debit 6100 / Credit 1100
}
```

And redefine balances so they can never be gamed by direct field edits:

- `Customer.balance` = `Σ(CustomerLedger.debit) − Σ(CustomerLedger.credit)` — **always derived, never directly writable** via any update endpoint. Strip it from every Zod update schema.
- `Available Credit` for a new sale = `creditLimit − grossOpenInvoices` (NOT net of unapplied deposits). Track deposits and aging separately so a customer with a 90-day-overdue invoice can't hide behind an unrelated advance payment.
- Same pattern for `Supplier.balance`.

---

## 7. Concurrency — stop the oversell race

Add explicit row locks to the four operations where two simultaneous requests can both read a stale number and both commit:

```sql
SELECT * FROM "Product" WHERE id = $1 FOR UPDATE;   -- inside the same transaction, before validating stock
```
Required on: Invoice creation, Purchase receipt, Sales Return, Purchase Return (`Product` row), and `Invoice`/`Customer` row during Payment Allocation. This is a one-line addition to each model's transaction — do it before the `adjustStock` call, not after.

---

## 8. Reconciliation — trust but verify

Add a scheduled (or manually-triggered from the admin dashboard) verification script, alongside your existing `clean-db.js` / `backup-db.js` in `scratch/`:

```
for each Product:
  expectedQty = Σ StockMovement.quantity WHERE type='IN' − Σ StockMovement.quantity WHERE type='OUT'
  assert expectedQty === Product.stockQuantity

for each Customer:
  expectedBalance = Σ CustomerLedger.debit − Σ CustomerLedger.credit
  assert expectedBalance === Customer.balance

assert Σ GLJournalEntry.debit === Σ GLJournalEntry.credit   // trial balance must always net to zero
```
Run this after every deploy and on a nightly cron. Any mismatch is a bug caught immediately, not discovered three months later during an audit.

---

## 9. Schema/enum changes needed

- `ReferenceType` enum: add `PAYMENT`, `CORRECTION`, `DEPOSIT`, `WRITE_OFF` (your current workaround of reusing `INVOICE`/`PURCHASE` for payments makes ledger queries ambiguous — fix this now while the dataset is still small).
- Add `status` (`DRAFT | POSTED | VOIDED`) to `Invoice` and `Purchase`.
- Change cost/WAC columns to `Decimal(12,4)`; keep money columns at `Decimal(12,2)`.
- Add the `GLAccount` / `GLJournalEntry` tables above.
- Add `CustomerDeposit`, `CreditNote`, `DebitNote`, `BadDebtWriteOff` tables above.

---

## 10. Implementation order (don't do this all at once)

1. **Schema migration** — add new tables/enums/columns. Backfill `status = 'POSTED'` on all existing rows. No behavior change yet.
2. **Fix Purchase Return WAC math** (§2) — this is your active corruption; fix it first in isolation, verify with the reconciliation script (§8) before touching anything else.
3. **Fix discount allocation** (§3) — audit `invoice-model.js` for the three failure modes, add the remainder-on-last-line rule.
4. **Add row locking** (§7) to the four transactional models.
5. **Bolt on the GL engine** (§4) — write GL rows alongside existing writes for *new* transactions only. Don't try to backfill GL history for old transactions unless you need historical P&L to match GL retroactively; if you do, write a one-time backfill script that derives GL rows from existing `StockMovement`/`InvoiceItem` snapshots.
6. **Switch reports to read GL** (§4 formulas) instead of live sub-ledger sums.
7. **Enforce immutability** (§5) — add the Postgres triggers last, once you're confident normal flows never need to update/delete these rows.
8. **Add the four missing entities** (§6) whenever the workaround pain (fake returns for write-offs, etc.) becomes real — this is lower urgency than 1–7.

Each step has its own verification script per your existing Phase-gate discipline ("every completed phase must pass its verification scripts before moving to the next") — don't skip that here; it's exactly what will catch a regression before it becomes another silent WAC corruption.
