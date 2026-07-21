/**
 * ============================================================
 *  SameerTraderz IMS — Audit & Reconciliation Script
 *  Run: node backend/scratch/audit_reconciliation.js
 *
 *  This script is READ-ONLY: it never writes to the database.
 *  It exits with code 0 if all checks pass, 1 if any critical
 *  issues are found (useful for CI/CD gating).
 * ============================================================
 */

"use strict";

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { PrismaClient } = require("../generated/prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");

// ── Prisma setup (read-only intent — no writes happen in this script) ─────────
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter, log: ["error"] });

// ── ANSI colour helpers ───────────────────────────────────────────────────────
const R = (s) => `\x1b[31m${s}\x1b[0m`; // red
const Y = (s) => `\x1b[33m${s}\x1b[0m`; // yellow
const G = (s) => `\x1b[32m${s}\x1b[0m`; // green
const B = (s) => `\x1b[34m${s}\x1b[0m`; // blue / header
const W = (s) => `\x1b[1m${s}\x1b[0m`;  // bold

const TOLERANCE = 0.011; // floating-point tolerance (Rs. 0.01)

// ── Scorecard state ───────────────────────────────────────────────────────────
const issues = {
  critical: [],  // 🔴
  warnings: [],  // 🟡
  passes:   [],  // 🟢
};

function critical(msg, detail = "") {
  issues.critical.push({ msg, detail });
}
function warn(msg, detail = "") {
  issues.warnings.push({ msg, detail });
}
function pass(msg) {
  issues.passes.push(msg);
}

function section(title) {
  console.log(`\n${B("═".repeat(60))}`);
  console.log(B(`  ${title}`));
  console.log(B("═".repeat(60)));
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function drift(a, b) {
  return Math.abs(Number(a) - Number(b));
}
function hasDrift(a, b) {
  return drift(a, b) > TOLERANCE;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CHECK 1 — Inventory vs. Stock Movement Reconciliation
// ═══════════════════════════════════════════════════════════════════════════════
async function checkStockMovementReconciliation() {
  section("CHECK 1 · Inventory vs Stock Movement Reconciliation");

  // Sum all movements per product using raw SQL (fast, single query)
  const movementTotals = await prisma.$queryRaw`
    SELECT
      "productId",
      SUM(CASE WHEN type = 'IN'  THEN quantity ELSE -quantity END)::int AS "calculatedQty"
    FROM "StockMovement"
    GROUP BY "productId"
  `;

  const movementMap = {};
  for (const row of movementTotals) {
    movementMap[row.productId] = Number(row.calculatedQty);
  }

  // Fetch all products
  const products = await prisma.product.findMany({
    select: { id: true, name: true, sku: true, stockQuantity: true },
  });

  const drifted = [];
  const negativeStock = [];

  for (const p of products) {
    const actual = Number(p.stockQuantity);
    const calculated = movementMap[p.id] ?? 0; // product with NO movements should have 0 stock

    if (actual < 0) {
      negativeStock.push({ id: p.id, name: p.name, sku: p.sku, actual });
    }

    if (Math.abs(actual - calculated) > 0) {
      drifted.push({
        id: p.id,
        name: p.name,
        sku: p.sku,
        storedStock: actual,
        calculatedStock: calculated,
        variance: actual - calculated,
      });
    }
  }

  // Products with stock but ZERO movement logs (written outside adjustStock())
  const productsWithNoMovements = products.filter(
    (p) => movementMap[p.id] === undefined && Number(p.stockQuantity) !== 0
  );

  if (drifted.length === 0) {
    pass("All product stockQuantity values match their StockMovement sums exactly.");
    console.log(G("  ✔ No stock drift detected across all products."));
  } else {
    for (const d of drifted) {
      critical(
        `Stock drift on Product ID ${d.id} "${d.name}" (SKU: ${d.sku ?? "N/A"})`,
        `  Stored: ${d.storedStock} | Calculated from movements: ${d.calculatedStock} | Variance: ${d.variance > 0 ? "+" : ""}${d.variance}`
      );
      console.log(
        R(`  ✘ Product #${d.id} "${d.name}": stored=${d.storedStock}, movements_sum=${d.calculatedStock}, variance=${d.variance}`)
      );
    }
  }

  if (negativeStock.length > 0) {
    for (const p of negativeStock) {
      critical(
        `Negative stockQuantity on Product ID ${p.id} "${p.name}"`,
        `  Stored stock = ${p.actual}. This should NEVER happen — adjustStock() blocks negative stock.`
      );
      console.log(R(`  ✘ Negative stock: Product #${p.id} "${p.name}" = ${p.actual}`));
    }
  } else {
    pass("No products have negative stock quantities.");
    console.log(G("  ✔ No negative stock balances found."));
  }

  if (productsWithNoMovements.length > 0) {
    for (const p of productsWithNoMovements) {
      warn(
        `Product ID ${p.id} "${p.name}" has stockQuantity=${p.stockQuantity} but ZERO StockMovement rows`,
        "  Possible direct write to stockQuantity bypassing adjustStock(). Investigate seeding or migration scripts."
      );
      console.log(Y(`  ⚠ Product #${p.id} "${p.name}": non-zero stock but no movement log rows.`));
    }
  }

  // Check for StockMovements with zero or negative quantity (data quality)
  const badMovements = await prisma.stockMovement.findMany({
    where: { quantity: { lte: 0 } },
    select: { id: true, productId: true, quantity: true, type: true, referenceType: true },
  });
  if (badMovements.length > 0) {
    for (const m of badMovements) {
      critical(
        `StockMovement ID ${m.id} has quantity=${m.quantity} (must always be > 0)`,
        `  productId=${m.productId}, type=${m.type}, referenceType=${m.referenceType}`
      );
    }
  } else {
    pass("All StockMovement rows have positive quantities.");
    console.log(G("  ✔ All StockMovement quantities are positive."));
  }

  console.log(`\n  Summary: ${drifted.length} drift(s), ${negativeStock.length} negative balance(s), ${productsWithNoMovements.length} ghost stock product(s).`);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CHECK 2 — Invoice Math Integrity
// ═══════════════════════════════════════════════════════════════════════════════
async function checkInvoiceMathIntegrity() {
  section("CHECK 2 · Invoice Math & balanceDue Integrity");

  const invoices = await prisma.invoice.findMany({
    include: { items: true },
  });

  let subtotalMismatches = 0;
  let balanceMismatches = 0;
  let statusMismatches = 0;

  for (const inv of invoices) {
    // (a) Validate subtotal = SUM(item.totalPrice)
    const itemSum = inv.items.reduce((sum, item) => sum + Number(item.totalPrice), 0);
    // Note: subtotal is BEFORE item-level discounts are baked in — the stored subtotal
    // is raw (qty * unitPrice), and the discount field absorbs the reductions.
    // So we re-check: total = subtotal - discount
    const expectedTotal = Number(inv.subtotal) - Number(inv.discount ?? 0);
    const storedTotal = Number(inv.total);

    if (hasDrift(expectedTotal, storedTotal)) {
      critical(
        `Invoice #${inv.invoiceNo} (ID:${inv.id}) — total mismatch`,
        `  Expected: subtotal(${Number(inv.subtotal)}) - discount(${Number(inv.discount ?? 0)}) = ${expectedTotal.toFixed(2)}  |  Stored total: ${storedTotal.toFixed(2)}`
      );
      console.log(R(`  ✘ Invoice #${inv.invoiceNo}: computed total=${expectedTotal.toFixed(2)}, stored=${storedTotal.toFixed(2)}`));
      subtotalMismatches++;
    }

    // (b) Validate balanceDue = total - transportDiscount - paidAmount - creditApplied - returnedAmount
    const expectedBalanceDue = Math.max(
      0,
      storedTotal -
        Number(inv.transportDiscount ?? 0) -
        Number(inv.paidAmount ?? 0) -
        Number(inv.creditApplied ?? 0) -
        Number(inv.returnedAmount ?? 0)
    );
    const storedBalanceDue = Number(inv.balanceDue);

    if (hasDrift(expectedBalanceDue, storedBalanceDue)) {
      critical(
        `Invoice #${inv.invoiceNo} (ID:${inv.id}) — balanceDue mismatch`,
        `  Computed: ${expectedBalanceDue.toFixed(2)}  |  Stored: ${storedBalanceDue.toFixed(2)}  |  Drift: ${drift(expectedBalanceDue, storedBalanceDue).toFixed(4)}`
      );
      console.log(R(`  ✘ Invoice #${inv.invoiceNo}: computed balanceDue=${expectedBalanceDue.toFixed(2)}, stored=${storedBalanceDue.toFixed(2)}`));
      balanceMismatches++;
    }

    // (c) Validate status matches balanceDue
    const netPayable = storedTotal - Number(inv.transportDiscount ?? 0);
    const totalSettled =
      Number(inv.paidAmount ?? 0) +
      Number(inv.creditApplied ?? 0) +
      Number(inv.returnedAmount ?? 0);
    const expectedStatus =
      totalSettled + Number(inv.transportDiscount ?? 0) >= storedTotal
        ? "PAID"
        : totalSettled > 0
        ? "PARTIALLY_PAID"
        : "UNPAID";

    if (inv.status !== expectedStatus) {
      warn(
        `Invoice #${inv.invoiceNo} (ID:${inv.id}) — status mismatch`,
        `  Stored status: "${inv.status}"  |  Expected: "${expectedStatus}"`
      );
      console.log(Y(`  ⚠ Invoice #${inv.invoiceNo}: status="${inv.status}" but should be "${expectedStatus}"`));
      statusMismatches++;
    }
  }

  if (subtotalMismatches === 0 && balanceMismatches === 0) {
    pass("All invoice totals and balanceDue values are mathematically consistent.");
    console.log(G("  ✔ All invoices pass total and balanceDue checks."));
  }
  if (statusMismatches === 0) {
    pass("All invoice statuses are correct.");
    console.log(G("  ✔ All invoice statuses (PAID/PARTIALLY_PAID/UNPAID) are accurate."));
  }

  // Check for CREDIT invoices that have no customerId
  const orphanedCreditInvoices = await prisma.invoice.findMany({
    where: { saleType: "CREDIT", customerId: null },
    select: { id: true, invoiceNo: true },
  });
  if (orphanedCreditInvoices.length > 0) {
    for (const inv of orphanedCreditInvoices) {
      critical(
        `Credit invoice #${inv.invoiceNo} (ID:${inv.id}) has NO customerId`,
        "  A CREDIT sale MUST have a customer. This invoice can never be collected on."
      );
      console.log(R(`  ✘ CREDIT invoice #${inv.invoiceNo} has null customerId!`));
    }
  } else {
    pass("All CREDIT invoices have a linked customer.");
    console.log(G("  ✔ All CREDIT invoices have a customerId."));
  }

  console.log(`\n  Summary: ${subtotalMismatches} total/subtotal mismatch(es), ${balanceMismatches} balanceDue mismatch(es), ${statusMismatches} status mismatch(es).`);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CHECK 3 — Sales Return Integrity
// ═══════════════════════════════════════════════════════════════════════════════
async function checkSalesReturnIntegrity() {
  section("CHECK 3 · Sales Return — Stock & Ledger Integrity");

  const salesReturns = await prisma.salesReturn.findMany({
    include: { items: true, invoice: { include: { items: true } } },
  });

  let orphanedStockReturns = 0;
  let orphanedLedgerReturns = 0;
  let overReturnCount = 0;

  for (const sr of salesReturns) {
    const returnId = sr.id;
    const returnNo = sr.returnNo ?? `ID:${sr.id}`;

    // (a) Each SalesReturn item must have a corresponding StockMovement (IN, SALES_RETURN)
    for (const item of sr.items) {
      const movement = await prisma.stockMovement.findFirst({
        where: {
          productId: item.productId,
          referenceType: "SALES_RETURN",
          referenceId: returnId,
          type: "IN",
        },
      });

      if (!movement) {
        critical(
          `Sales Return ${returnNo} — Missing stock movement for Product ID ${item.productId}`,
          `  Expected: StockMovement IN, referenceType=SALES_RETURN, referenceId=${returnId}. Stock was NOT restocked!`
        );
        console.log(R(`  ✘ Return ${returnNo}: no IN StockMovement for productId=${item.productId}`));
        orphanedStockReturns++;
      } else if (movement.quantity !== item.quantity) {
        warn(
          `Sales Return ${returnNo} — StockMovement quantity mismatch for Product ID ${item.productId}`,
          `  Return item qty: ${item.quantity}  |  Movement qty: ${movement.quantity}`
        );
      }
    }

    // (b) If the original invoice had a customer, a CustomerLedger CREDIT entry must exist
    if (sr.customerId) {
      const ledgerEntry = await prisma.customerLedger.findFirst({
        where: {
          customerId: sr.customerId,
          referenceType: "SALES_RETURN",
          referenceId: returnId,
          credit: { gt: 0 },
        },
      });

      if (!ledgerEntry) {
        critical(
          `Sales Return ${returnNo} — Missing CustomerLedger CREDIT for Customer ID ${sr.customerId}`,
          "  The return reduced stock but the customer's ledger was NOT credited. Balance is inflated."
        );
        console.log(R(`  ✘ Return ${returnNo}: no CustomerLedger CREDIT entry for customerId=${sr.customerId}`));
        orphanedLedgerReturns++;
      }
    }

    // (c) Verify over-return: sum of all return items for a product must not exceed original invoice qty
    if (sr.invoiceId && sr.invoice) {
      const soldQtyMap = {};
      for (const ii of sr.invoice.items) {
        soldQtyMap[ii.productId] = (soldQtyMap[ii.productId] || 0) + ii.quantity;
      }

      // Get ALL returns for this invoice
      const allReturnsForInvoice = await prisma.salesReturnItem.findMany({
        where: {
          salesReturn: { invoiceId: sr.invoiceId },
        },
        select: { productId: true, quantity: true },
      });

      const totalReturnedMap = {};
      for (const ri of allReturnsForInvoice) {
        totalReturnedMap[ri.productId] = (totalReturnedMap[ri.productId] || 0) + ri.quantity;
      }

      for (const [productId, returnedQty] of Object.entries(totalReturnedMap)) {
        const soldQty = soldQtyMap[Number(productId)] || 0;
        if (returnedQty > soldQty) {
          critical(
            `Invoice ID ${sr.invoiceId} — Over-return detected for Product ID ${productId}`,
            `  Total sold: ${soldQty}  |  Total returned across all returns: ${returnedQty}  |  Over-return by: ${returnedQty - soldQty}`
          );
          console.log(R(`  ✘ Invoice #${sr.invoiceId}: product ${productId} returned ${returnedQty} but only ${soldQty} were sold!`));
          overReturnCount++;
        }
      }
    }
  }

  if (orphanedStockReturns === 0 && orphanedLedgerReturns === 0 && overReturnCount === 0) {
    pass("All sales returns have matching stock movements and ledger credits.");
    console.log(G("  ✔ All sales returns are fully reconciled (stock + ledger)."));
  }

  console.log(`\n  Summary: ${orphanedStockReturns} missing stock movement(s), ${orphanedLedgerReturns} missing ledger credit(s), ${overReturnCount} over-return(s).`);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CHECK 4 — Purchase Return Integrity
// ═══════════════════════════════════════════════════════════════════════════════
async function checkPurchaseReturnIntegrity() {
  section("CHECK 4 · Purchase Return — Stock & Supplier Ledger Integrity");

  const purchaseReturns = await prisma.purchaseReturn.findMany({
    include: { items: true },
  });

  let missingStockOut = 0;
  let missingSupplierDebit = 0;

  for (const pr of purchaseReturns) {
    const returnNo = pr.returnNo ?? `ID:${pr.id}`;

    // (a) Each PurchaseReturn item must have a StockMovement OUT
    for (const item of pr.items) {
      const movement = await prisma.stockMovement.findFirst({
        where: {
          productId: item.productId,
          referenceType: "PURCHASE_RETURN",
          referenceId: pr.id,
          type: "OUT",
        },
      });

      if (!movement) {
        critical(
          `Purchase Return ${returnNo} — Missing OUT stock movement for Product ID ${item.productId}`,
          `  Stock was NOT removed when goods were returned to supplier!`
        );
        console.log(R(`  ✘ PR ${returnNo}: no OUT StockMovement for productId=${item.productId}`));
        missingStockOut++;
      }
    }

    // (b) SupplierLedger DEBIT entry must exist for this return
    const ledgerEntry = await prisma.supplierLedger.findFirst({
      where: {
        supplierId: pr.supplierId,
        referenceType: "PURCHASE_RETURN",
        referenceId: pr.id,
        debit: { gt: 0 },
      },
    });

    if (!ledgerEntry) {
      critical(
        `Purchase Return ${returnNo} — Missing SupplierLedger DEBIT for Supplier ID ${pr.supplierId}`,
        "  The return reduced stock but supplier's liability was NOT decremented!"
      );
      console.log(R(`  ✘ PR ${returnNo}: no SupplierLedger DEBIT for supplierId=${pr.supplierId}`));
      missingSupplierDebit++;
    }
  }

  if (missingStockOut === 0 && missingSupplierDebit === 0) {
    pass("All purchase returns have matching OUT stock movements and supplier ledger debits.");
    console.log(G("  ✔ All purchase returns are fully reconciled (stock + supplier ledger)."));
  }

  console.log(`\n  Summary: ${missingStockOut} missing OUT movement(s), ${missingSupplierDebit} missing supplier debit(s).`);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CHECK 5 — Customer Ledger Reconciliation
// ═══════════════════════════════════════════════════════════════════════════════
async function checkCustomerLedgerReconciliation() {
  section("CHECK 5 · Customer Ledger Reconciliation");

  const customers = await prisma.customer.findMany({
    select: { id: true, name: true, balance: true },
  });

  let driftCount = 0;
  let runningMismatchCount = 0;
  let duplicateCount = 0;

  for (const cust of customers) {
    // Fetch all ledger entries ordered by createdAt
    const entries = await prisma.customerLedger.findMany({
      where: { customerId: cust.id },
      orderBy: { createdAt: "asc" },
    });

    if (entries.length === 0) continue; // customer never transacted

    // Recompute sum from entries
    let calculatedSum = 0;
    let runningBalanceMismatch = false;

    for (const entry of entries) {
      calculatedSum += Number(entry.debit) - Number(entry.credit);
      if (Math.abs(calculatedSum - Number(entry.balance)) > TOLERANCE) {
        runningBalanceMismatch = true;
      }
    }

    const storedBalance = Number(cust.balance);
    if (hasDrift(calculatedSum, storedBalance)) {
      critical(
        `Customer ID ${cust.id} "${cust.name}" — balance drift`,
        `  Stored Customer.balance: ${storedBalance.toFixed(2)}  |  Ledger sum: ${calculatedSum.toFixed(2)}  |  Drift: ${drift(calculatedSum, storedBalance).toFixed(4)}`
      );
      console.log(R(`  ✘ Customer "${cust.name}" (#${cust.id}): balance=${storedBalance}, ledger_sum=${calculatedSum.toFixed(2)}`));
      driftCount++;
    }

    if (runningBalanceMismatch) {
      warn(
        `Customer ID ${cust.id} "${cust.name}" — running balance mismatch in ledger`,
        "  The snapshot balance stored on ledger rows does not match the running cumulative sum. A ledger entry may have been inserted out of order or edited."
      );
      runningMismatchCount++;
    }

    // Detect duplicate ledger entries (same referenceType + referenceId + amounts)
    const keys = new Set();
    for (const entry of entries) {
      const key = `${entry.referenceType}-${entry.referenceId}-${entry.debit}-${entry.credit}`;
      if (keys.has(key)) {
        warn(
          `Customer ID ${cust.id} "${cust.name}" — duplicate ledger entry detected`,
          `  Duplicate key: ${key}. This means a ledger entry was double-posted.`
        );
        duplicateCount++;
      } else {
        keys.add(key);
      }
    }
  }

  if (driftCount === 0) {
    pass("All customer balances match their ledger sums.");
    console.log(G("  ✔ All customer ledger balances are in sync."));
  }
  if (runningMismatchCount === 0) {
    pass("All customer ledger running-balance snapshots are accurate.");
    console.log(G("  ✔ No running-balance snapshot mismatches in customer ledger."));
  }
  if (duplicateCount === 0) {
    pass("No duplicate customer ledger entries found.");
    console.log(G("  ✔ No duplicate ledger entries detected."));
  }

  console.log(`\n  Summary: ${driftCount} drift(s), ${runningMismatchCount} running-balance mismatch(es), ${duplicateCount} duplicate(s).`);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CHECK 6 — Supplier Ledger Reconciliation
// ═══════════════════════════════════════════════════════════════════════════════
async function checkSupplierLedgerReconciliation() {
  section("CHECK 6 · Supplier Ledger Reconciliation");

  const suppliers = await prisma.supplier.findMany({
    select: { id: true, name: true, balance: true },
  });

  let driftCount = 0;
  let runningMismatchCount = 0;
  let duplicateCount = 0;

  for (const sup of suppliers) {
    const entries = await prisma.supplierLedger.findMany({
      where: { supplierId: sup.id },
      orderBy: { createdAt: "asc" },
    });

    if (entries.length === 0) continue;

    let calculatedSum = 0;
    let runningBalanceMismatch = false;

    for (const entry of entries) {
      // SupplierLedger: credit = purchase (increases debt), debit = payment (decreases debt)
      calculatedSum += Number(entry.credit) - Number(entry.debit);
      if (Math.abs(calculatedSum - Number(entry.balance)) > TOLERANCE) {
        runningBalanceMismatch = true;
      }
    }

    const storedBalance = Number(sup.balance);
    if (hasDrift(calculatedSum, storedBalance)) {
      critical(
        `Supplier ID ${sup.id} "${sup.name}" — balance drift`,
        `  Stored Supplier.balance: ${storedBalance.toFixed(2)}  |  Ledger sum: ${calculatedSum.toFixed(2)}  |  Drift: ${drift(calculatedSum, storedBalance).toFixed(4)}`
      );
      console.log(R(`  ✘ Supplier "${sup.name}" (#${sup.id}): balance=${storedBalance}, ledger_sum=${calculatedSum.toFixed(2)}`));
      driftCount++;
    }

    if (runningBalanceMismatch) {
      warn(
        `Supplier ID ${sup.id} "${sup.name}" — running balance mismatch in ledger`,
        "  A ledger snapshot balance does not match expected running total."
      );
      runningMismatchCount++;
    }

    const keys = new Set();
    for (const entry of entries) {
      const key = `${entry.referenceType}-${entry.referenceId}-${entry.debit}-${entry.credit}`;
      if (keys.has(key)) {
        warn(
          `Supplier ID ${sup.id} "${sup.name}" — duplicate ledger entry`,
          `  Duplicate key: ${key}`
        );
        duplicateCount++;
      } else {
        keys.add(key);
      }
    }
  }

  if (driftCount === 0) {
    pass("All supplier balances match their ledger sums.");
    console.log(G("  ✔ All supplier ledger balances are in sync."));
  }
  if (runningMismatchCount === 0) {
    pass("All supplier ledger running-balance snapshots are accurate.");
    console.log(G("  ✔ No running-balance snapshot mismatches in supplier ledger."));
  }
  if (duplicateCount === 0) {
    pass("No duplicate supplier ledger entries found.");
    console.log(G("  ✔ No duplicate supplier ledger entries detected."));
  }

  console.log(`\n  Summary: ${driftCount} drift(s), ${runningMismatchCount} running-balance mismatch(es), ${duplicateCount} duplicate(s).`);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CHECK 7 — Payment Allocation Integrity
// ═══════════════════════════════════════════════════════════════════════════════
async function checkPaymentAllocationIntegrity() {
  section("CHECK 7 · Payment Allocation Integrity");

  // (a) Total allocated per CustomerPayment must not exceed payment amount
  const customerPayments = await prisma.customerPayment.findMany({
    include: { allocations: true },
  });

  let overAllocated = 0;
  for (const cp of customerPayments) {
    const totalAllocated = cp.allocations.reduce(
      (s, a) => s + Number(a.amountAllocated),
      0
    );
    if (totalAllocated > Number(cp.amount) + TOLERANCE) {
      critical(
        `CustomerPayment ID ${cp.id} — over-allocated`,
        `  Payment amount: ${Number(cp.amount).toFixed(2)}  |  Total allocated: ${totalAllocated.toFixed(2)}  |  Over by: ${(totalAllocated - Number(cp.amount)).toFixed(4)}`
      );
      console.log(R(`  ✘ CustomerPayment #${cp.id}: allocated=${totalAllocated} > amount=${Number(cp.amount)}`));
      overAllocated++;
    }
  }

  // (b) Same for SupplierPayments
  const supplierPayments = await prisma.supplierPayment.findMany({
    include: { allocations: true },
  });

  let supplierOverAllocated = 0;
  for (const sp of supplierPayments) {
    const totalAllocated = sp.allocations.reduce(
      (s, a) => s + Number(a.amountAllocated),
      0
    );
    if (totalAllocated > Number(sp.amount) + TOLERANCE) {
      critical(
        `SupplierPayment ID ${sp.id} — over-allocated`,
        `  Payment amount: ${Number(sp.amount).toFixed(2)}  |  Total allocated: ${totalAllocated.toFixed(2)}`
      );
      console.log(R(`  ✘ SupplierPayment #${sp.id}: allocated=${totalAllocated} > amount=${Number(sp.amount)}`));
      supplierOverAllocated++;
    }
  }

  if (overAllocated === 0 && supplierOverAllocated === 0) {
    pass("No over-allocated payments detected (customer or supplier).");
    console.log(G("  ✔ All payment allocations are within their payment amounts."));
  }

  // (c) Verify: for each Invoice allocation, Invoice.paidAmount >= sum of its PaymentAllocations
  const invoiceAllocations = await prisma.$queryRaw`
    SELECT "invoiceId", SUM("amountAllocated")::numeric AS total_allocated
    FROM "PaymentAllocation"
    GROUP BY "invoiceId"
  `;

  let allocationVsInvoiceDrift = 0;
  for (const row of invoiceAllocations) {
    const inv = await prisma.invoice.findUnique({
      where: { id: Number(row.invoiceId) },
      select: { id: true, invoiceNo: true, paidAmount: true, creditApplied: true },
    });
    if (!inv) continue;

    const totalAllocated = Number(row.total_allocated);
    const totalSettled = Number(inv.paidAmount) + Number(inv.creditApplied ?? 0);

    if (totalAllocated > totalSettled + TOLERANCE) {
      warn(
        `Invoice #${inv.invoiceNo} (ID:${inv.id}) — allocation sum exceeds paidAmount+creditApplied`,
        `  Total allocated via PaymentAllocation: ${totalAllocated.toFixed(2)}  |  Invoice paidAmount+creditApplied: ${totalSettled.toFixed(2)}`
      );
      console.log(Y(`  ⚠ Invoice #${inv.invoiceNo}: allocations=${totalAllocated} > paidAmount+credit=${totalSettled}`));
      allocationVsInvoiceDrift++;
    }
  }

  if (allocationVsInvoiceDrift === 0) {
    pass("All invoice allocation sums match paidAmount + creditApplied on invoices.");
    console.log(G("  ✔ PaymentAllocation sums match invoice settled amounts."));
  }

  console.log(`\n  Summary: ${overAllocated} customer over-allocation(s), ${supplierOverAllocated} supplier over-allocation(s), ${allocationVsInvoiceDrift} invoice drift(s).`);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CHECK 8 — Purchase Math Integrity
// ═══════════════════════════════════════════════════════════════════════════════
async function checkPurchaseMathIntegrity() {
  section("CHECK 8 · Purchase Math & balanceDue Integrity");

  const purchases = await prisma.purchase.findMany({
    include: { items: true },
  });

  let totalMismatches = 0;
  let balanceMismatches = 0;
  let statusMismatches = 0;

  for (const pur of purchases) {
    const expectedTotal = Number(pur.subtotal) - Number(pur.discount ?? 0);
    const storedTotal = Number(pur.total);

    if (hasDrift(expectedTotal, storedTotal)) {
      critical(
        `Purchase #${pur.purchaseNo} (ID:${pur.id}) — total mismatch`,
        `  Expected: ${expectedTotal.toFixed(2)}  |  Stored: ${storedTotal.toFixed(2)}`
      );
      console.log(R(`  ✘ Purchase #${pur.purchaseNo}: computed total=${expectedTotal.toFixed(2)}, stored=${storedTotal.toFixed(2)}`));
      totalMismatches++;
    }

    const expectedBalanceDue =
      storedTotal -
      Number(pur.paidAmount ?? 0) -
      Number(pur.creditApplied ?? 0) -
      Number(pur.returnedAmount ?? 0);
    const storedBalanceDue = Number(pur.balanceDue);

    if (hasDrift(expectedBalanceDue, storedBalanceDue)) {
      critical(
        `Purchase #${pur.purchaseNo} (ID:${pur.id}) — balanceDue mismatch`,
        `  Computed: ${expectedBalanceDue.toFixed(2)}  |  Stored: ${storedBalanceDue.toFixed(2)}`
      );
      console.log(R(`  ✘ Purchase #${pur.purchaseNo}: computed balanceDue=${expectedBalanceDue.toFixed(2)}, stored=${storedBalanceDue.toFixed(2)}`));
      balanceMismatches++;
    }

    const totalSettled =
      Number(pur.paidAmount ?? 0) +
      Number(pur.creditApplied ?? 0) +
      Number(pur.returnedAmount ?? 0);
    const expectedStatus =
      totalSettled >= storedTotal
        ? "PAID"
        : totalSettled > 0
        ? "PARTIALLY_PAID"
        : "UNPAID";

    if (pur.status !== expectedStatus) {
      warn(
        `Purchase #${pur.purchaseNo} (ID:${pur.id}) — status mismatch`,
        `  Stored: "${pur.status}"  |  Expected: "${expectedStatus}"`
      );
      statusMismatches++;
    }
  }

  if (totalMismatches === 0 && balanceMismatches === 0) {
    pass("All purchase totals and balanceDue values are mathematically consistent.");
    console.log(G("  ✔ All purchases pass total and balanceDue checks."));
  }
  if (statusMismatches === 0) {
    pass("All purchase statuses are correct.");
    console.log(G("  ✔ All purchase statuses are accurate."));
  }

  console.log(`\n  Summary: ${totalMismatches} total mismatch(es), ${balanceMismatches} balanceDue mismatch(es), ${statusMismatches} status mismatch(es).`);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CHECK 9 — Orphaned / Dangling Reference Checks
// ═══════════════════════════════════════════════════════════════════════════════
async function checkOrphanedReferences() {
  section("CHECK 9 · Orphaned & Dangling Reference Integrity");

  // StockMovements that reference a non-existent Purchase / Invoice / Return / Adjustment
  const movements = await prisma.stockMovement.findMany({
    select: { id: true, referenceType: true, referenceId: true, productId: true },
  });

  let orphanedMovements = 0;
  for (const mv of movements) {
    let exists = true;
    const id = Number(mv.referenceId);
    if (mv.referenceType === "PURCHASE") {
      exists = !!(await prisma.purchase.findUnique({ where: { id } }));
    } else if (mv.referenceType === "INVOICE") {
      exists = !!(await prisma.invoice.findUnique({ where: { id } }));
    } else if (mv.referenceType === "SALES_RETURN") {
      exists = !!(await prisma.salesReturn.findUnique({ where: { id } }));
    } else if (mv.referenceType === "PURCHASE_RETURN") {
      exists = !!(await prisma.purchaseReturn.findUnique({ where: { id } }));
    } else if (mv.referenceType === "ADJUSTMENT" || mv.referenceType === "STOCK_ADJUSTMENT") {
      exists = !!(await prisma.stockAdjustment.findUnique({ where: { id } })) || id === 1;
    }

    if (!exists) {
      critical(
        `StockMovement ID ${mv.id} — dangling referenceId`,
        `  referenceType=${mv.referenceType}, referenceId=${mv.referenceId} — the parent record no longer exists!`
      );
      console.log(R(`  ✘ StockMovement #${mv.id}: ${mv.referenceType}#${mv.referenceId} not found`));
      orphanedMovements++;
    }
  }

  if (orphanedMovements === 0) {
    pass("All StockMovement rows have valid referenceId parent records.");
    console.log(G("  ✔ No dangling StockMovement references."));
  }

  // StockAdjustments without a matching StockMovement (schema invariant)
  const adjustments = await prisma.stockAdjustment.findMany({
    select: { id: true, productId: true, quantity: true },
  });

  let adjustmentsWithNoMovement = 0;
  for (const adj of adjustments) {
    const mv = await prisma.stockMovement.findFirst({
      where: { referenceType: "ADJUSTMENT", referenceId: adj.id },
    });
    if (!mv) {
      critical(
        `StockAdjustment ID ${adj.id} — missing StockMovement`,
        `  Every StockAdjustment must produce exactly one StockMovement row (createAdjustment() invariant).`
      );
      console.log(R(`  ✘ StockAdjustment #${adj.id}: no matching StockMovement`));
      adjustmentsWithNoMovement++;
    }
  }

  if (adjustmentsWithNoMovement === 0) {
    pass("All StockAdjustments have a matching StockMovement.");
    console.log(G("  ✔ All StockAdjustments are paired with a StockMovement."));
  }

  console.log(`\n  Summary: ${orphanedMovements} dangling movement(s), ${adjustmentsWithNoMovement} unpaired adjustment(s).`);
}

// ═══════════════════════════════════════════════════════════════════════════════
//  CHECK 10 — Production Readiness Warnings (code-level observations)
// ═══════════════════════════════════════════════════════════════════════════════
async function checkProductionReadiness() {
  section("CHECK 10 · Production Readiness — Data Health Warnings");

  // Inactive customers/suppliers with open balances
  const inactiveCustomersWithBalance = await prisma.customer.findMany({
    where: { isActive: false, balance: { not: 0 } },
    select: { id: true, name: true, balance: true },
  });
  for (const c of inactiveCustomersWithBalance) {
    warn(
      `Inactive Customer ID ${c.id} "${c.name}" has open balance: Rs. ${Number(c.balance).toFixed(2)}`,
      "  Inactive customers should have a zero balance before deactivation."
    );
    console.log(Y(`  ⚠ Inactive customer "${c.name}" (#${c.id}) has non-zero balance: ${Number(c.balance).toFixed(2)}`));
  }

  const inactiveSuppliersWithBalance = await prisma.supplier.findMany({
    where: { isActive: false, balance: { not: 0 } },
    select: { id: true, name: true, balance: true },
  });
  for (const s of inactiveSuppliersWithBalance) {
    warn(
      `Inactive Supplier ID ${s.id} "${s.name}" has open balance: Rs. ${Number(s.balance).toFixed(2)}`,
      "  Inactive suppliers should have a zero balance before deactivation."
    );
    console.log(Y(`  ⚠ Inactive supplier "${s.name}" (#${s.id}) has non-zero balance: ${Number(s.balance).toFixed(2)}`));
  }

  // Products below low stock level
  const lowStockProducts = await prisma.$queryRaw`
    SELECT id, name, sku, "stockQuantity", "lowStockLevel"
    FROM "Product"
    WHERE "isActive" = true
      AND "lowStockLevel" > 0
      AND "stockQuantity" < "lowStockLevel"
  `;
  if (lowStockProducts.length > 0) {
    warn(
      `${lowStockProducts.length} active product(s) are below their low stock threshold`,
      lowStockProducts
        .map((p) => `  Product #${p.id} "${p.name}" (SKU: ${p.sku ?? "N/A"}): stock=${p.stockQuantity}, threshold=${p.lowStockLevel}`)
        .join("\n")
    );
    console.log(Y(`  ⚠ ${lowStockProducts.length} product(s) below low stock threshold. Review replenishment.`));
  } else {
    pass("No active products are below their low stock threshold.");
    console.log(G("  ✔ All products are above their low stock thresholds."));
  }

  // UNPAID invoices older than 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const staleInvoices = await prisma.invoice.count({
    where: {
      status: { in: ["UNPAID", "PARTIALLY_PAID"] },
      invoiceDate: { lt: ninetyDaysAgo },
    },
  });
  if (staleInvoices > 0) {
    warn(
      `${staleInvoices} invoice(s) are UNPAID/PARTIALLY_PAID and older than 90 days`,
      "  Investigate as potential bad debt. These inflate Customer.balance figures."
    );
    console.log(Y(`  ⚠ ${staleInvoices} stale invoice(s) (> 90 days old) still have outstanding balance.`));
  } else {
    pass("No stale unpaid invoices older than 90 days.");
    console.log(G("  ✔ No stale invoices (>90 days) with outstanding balances."));
  }

  // Customers with negative balance (we owe them — i.e., over-credit)
  const customersWithCreditBalance = await prisma.customer.count({
    where: { balance: { lt: 0 } },
  });
  if (customersWithCreditBalance > 0) {
    warn(
      `${customersWithCreditBalance} customer(s) have a negative balance (store credit owed to them)`,
      "  Verify these are intentional (e.g., from sales returns). If unexpected, investigate for over-payment or double-return."
    );
    console.log(Y(`  ⚠ ${customersWithCreditBalance} customer(s) have negative balance (we owe them store credit).`));
  }

  // Suppliers with negative balance (they owe us — i.e., over-payment or unprocessed return credit)
  const suppliersWithCreditBalance = await prisma.supplier.count({
    where: { balance: { lt: 0 } },
  });
  if (suppliersWithCreditBalance > 0) {
    warn(
      `${suppliersWithCreditBalance} supplier(s) have a negative balance (credit from over-payments/returns)`,
      "  Verify these are intentional advance payments or purchase return credits."
    );
    console.log(Y(`  ⚠ ${suppliersWithCreditBalance} supplier(s) have negative balance.`));
  }

  if (inactiveCustomersWithBalance.length === 0 && inactiveSuppliersWithBalance.length === 0) {
    pass("No inactive customers or suppliers have open balances.");
    console.log(G("  ✔ No inactive parties carry open balances."));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
//  SCORECARD — final summary output
// ═══════════════════════════════════════════════════════════════════════════════
function printScorecard() {
  const totalChecks = issues.critical.length + issues.warnings.length + issues.passes.length;
  const weightedScore =
    totalChecks === 0
      ? 100
      : Math.round(
          ((issues.passes.length - issues.critical.length * 3) / totalChecks) * 100
        );
  const score = Math.max(0, Math.min(100, weightedScore));

  const scoreLabel =
    issues.critical.length === 0 && issues.warnings.length === 0
      ? G(`${score}% — ✅ PRODUCTION READY`)
      : issues.critical.length === 0
      ? Y(`${score}% — ⚠️  PASS WITH WARNINGS`)
      : R(`${score}% — ❌ FAIL (CRITICAL ISSUES FOUND)`);

  console.log(`\n${W("═".repeat(60))}`);
  console.log(W("  📊  PRODUCTION READINESS SCORECARD"));
  console.log(W("═".repeat(60)));

  if (issues.critical.length > 0) {
    console.log(R(`\n🔴 CRITICAL ISSUES (${issues.critical.length}):`));
    for (const issue of issues.critical) {
      console.log(R(`  • ${issue.msg}`));
      if (issue.detail) console.log(R(`${issue.detail}`));
    }
  }

  if (issues.warnings.length > 0) {
    console.log(Y(`\n🟡 WARNINGS (${issues.warnings.length}):`));
    for (const w of issues.warnings) {
      console.log(Y(`  • ${w.msg}`));
      if (w.detail) console.log(Y(`${w.detail}`));
    }
  }

  if (issues.passes.length > 0) {
    console.log(G(`\n🟢 PASSED CHECKS (${issues.passes.length}):`));
    for (const p of issues.passes) {
      console.log(G(`  ✔ ${p}`));
    }
  }

  console.log(`\n${W("─".repeat(60))}`);
  console.log(`  Score: ${scoreLabel}`);
  console.log(W("─".repeat(60)));

  if (issues.critical.length > 0) {
    console.log(R("\n  🔧 FIX RECOMMENDATIONS:"));
    console.log(R("  ─────────────────────────────────────────────────────"));
    console.log(R("  1. Stock Drift → Run stockModel.verifyIntegrity(productId)"));
    console.log(R("     then manually replay missing StockMovement rows or"));
    console.log(R("     SET stockQuantity = (movement sum) in a one-off migration."));
    console.log(R("  2. Invoice/Purchase balanceDue drift → Re-run the status"));
    console.log(R("     recalculation logic for affected records."));
    console.log(R("  3. Ledger balance drift → Use ledgerModel.reconcileCustomerLedger(id)"));
    console.log(R("     to get the exact mismatch, then insert a correcting entry."));
    console.log(R("  4. Missing StockMovement for return → A return was saved but the"));
    console.log(R("     transaction failed mid-way or was inserted outside the model."));
    console.log(R("  5. Over-return → Investigate SalesReturn.invoiceId linkage and"));
    console.log(R("     ensure createSalesReturn() was used exclusively."));
  }

  console.log();
  return issues.critical.length > 0 ? 1 : 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(W("\n🔍  SameerTraderz IMS — Audit & Reconciliation Script"));
  console.log(`    Connected to: ${process.env.DATABASE_URL?.replace(/:[^:@]*@/, ":****@") ?? "DATABASE_URL not set"}`);
  console.log(`    Timestamp: ${new Date().toISOString()}\n`);

  try {
    await checkStockMovementReconciliation();
    await checkInvoiceMathIntegrity();
    await checkSalesReturnIntegrity();
    await checkPurchaseReturnIntegrity();
    await checkCustomerLedgerReconciliation();
    await checkSupplierLedgerReconciliation();
    await checkPaymentAllocationIntegrity();
    await checkPurchaseMathIntegrity();
    await checkOrphanedReferences();
    await checkProductionReadiness();
  } catch (err) {
    console.error(R(`\n💥 FATAL ERROR during audit: ${err.message}`));
    console.error(err.stack);
    process.exit(2);
  } finally {
    await prisma.$disconnect();
  }

  const exitCode = printScorecard();
  process.exit(exitCode);
}

main();
