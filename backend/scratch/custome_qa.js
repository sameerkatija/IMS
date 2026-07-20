/**
 * COMPREHENSIVE ERP QA AUDIT — SAFE REWRITE
 *
 * Default mode (no env var) runs ONLY read-only checks: invariants,
 * orphan checks, impossible balances, performance. It never writes
 * to your database.
 *
 * Mutation-based tests (business simulation + critical bug probes)
 * only run if you explicitly opt in:
 *
 *     RUN_MUTATION_TESTS=true node erp-qa-audit.js
 *
 * When enabled, all mutation tests run against a dedicated synthetic
 * customer/supplier/product (name-prefixed "__QA_AUDIT_"), NEVER
 * against your real records. Everything created is deleted again in
 * a teardown step at the end, even if a test fails or throws.
 *
 * NOTE: A few lines below are marked with /* ADAPT * / — they assume
 * field/relation names based on the SQL already in your original
 * script, but your actual Prisma schema may use slightly different
 * names. Adjust those spots to match your schema before relying on
 * the result.
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const prisma = require("../config/prisma");

const MUTATION_TESTS_ENABLED = process.env.RUN_MUTATION_TESTS === "true";

// ─────────────────────────────────────────────────────────
// TEST FRAMEWORK
// ─────────────────────────────────────────────────────────
const results = [];
let passed = 0;
let failed = 0;
let warnings = 0;

function log(label, status, detail = "") {
    const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️ ";
    console.log(`${icon} [${status}] ${label}${detail ? " — " + detail : ""}`);
    results.push({ label, status, detail });
    if (status === "PASS") passed++;
    else if (status === "FAIL") failed++;
    else warnings++;
}

function section(name) {
    console.log(`\n${"=".repeat(70)}`);
    console.log(`  ${name}`);
    console.log("=".repeat(70));
}

async function safeRun(label, fn) {
    try {
        await fn();
    } catch (err) {
        log(label, "FAIL", `Unexpected exception: ${err.message}`);
    }
}

async function getAdminUser() {
    return prisma.user.findFirst({ where: { role: "ADMIN" } });
}

// ─────────────────────────────────────────────────────────
// PHASE 1: REGRESSION — Invoice invariants (full-table, no row cap)
// ─────────────────────────────────────────────────────────
async function phase1_InvoiceInvariants() {
    section("PHASE 1 — Invoice Invariants");

    const totalMismatches = await prisma.$queryRaw`
    SELECT i.id, i."invoiceNo", i.total::numeric AS total,
           COALESCE(SUM(ii."totalPrice"), 0)::numeric AS item_sum
    FROM "Invoice" i
    LEFT JOIN "InvoiceItem" ii ON ii."invoiceId" = i.id
    GROUP BY i.id, i."invoiceNo", i.total
    HAVING ABS(i.total - COALESCE(SUM(ii."totalPrice"), 0)) > 0.05
  `;
    const totalInvoices = await prisma.invoice.count();
    if (totalMismatches.length === 0) {
        log("Invoice.total == Sum(InvoiceItem.totalPrice)", "PASS", `Checked all ${totalInvoices} invoices`);
    } else {
        log("Invoice.total == Sum(InvoiceItem.totalPrice)", "FAIL", `${totalMismatches.length} invoices inconsistent`);
        totalMismatches.forEach(r =>
            console.log(`  Invoice ${r.invoiceNo}: items sum=${Number(r.item_sum).toFixed(4)}, total=${Number(r.total).toFixed(4)}`));
    }

    const balanceMismatches = await prisma.$queryRaw`
    SELECT id, "invoiceNo",
           total::numeric AS total, "paidAmount"::numeric AS paid,
           COALESCE("creditApplied", 0)::numeric AS credit,
           COALESCE("returnedAmount", 0)::numeric AS returned,
           "balanceDue"::numeric AS balance_due
    FROM "Invoice"
    WHERE ABS(total - "paidAmount" - COALESCE("creditApplied", 0) - COALESCE("returnedAmount", 0) - "balanceDue") > 0.02
  `;
    if (balanceMismatches.length === 0) {
        log("Invoice.balanceDue == total - paid - credit - returned", "PASS", `Checked all ${totalInvoices} invoices`);
    } else {
        log("Invoice.balanceDue == total - paid - credit - returned", "FAIL", `${balanceMismatches.length} invoices with balanceDue drift`);
        balanceMismatches.forEach(r =>
            console.log(`  Invoice ${r.invoiceNo}: stored balanceDue=${Number(r.balance_due).toFixed(4)}`));
    }
}

// ─────────────────────────────────────────────────────────
// PHASE 1: REGRESSION — Purchase invariants (full-table, no row cap)
// ─────────────────────────────────────────────────────────
async function phase1_PurchaseInvariants() {
    section("PHASE 1 — Purchase Invariants");

    const totalMismatches = await prisma.$queryRaw`
    SELECT p.id, p."purchaseNo", p.total::numeric AS total,
           COALESCE(SUM(pi."totalCost"), 0)::numeric AS item_sum
    FROM "Purchase" p
    LEFT JOIN "PurchaseItem" pi ON pi."purchaseId" = p.id
    GROUP BY p.id, p."purchaseNo", p.total
    HAVING ABS(p.total - COALESCE(SUM(pi."totalCost"), 0)) > 0.05
  `;
    const totalPurchases = await prisma.purchase.count();
    if (totalMismatches.length === 0) {
        log("Purchase.total == Sum(PurchaseItem.totalCost)", "PASS", `Checked all ${totalPurchases} purchases`);
    } else {
        log("Purchase.total == Sum(PurchaseItem.totalCost)", "FAIL", `${totalMismatches.length} purchases inconsistent`);
    }

    const balanceMismatches = await prisma.$queryRaw`
    SELECT id, "purchaseNo",
           total::numeric AS total, "paidAmount"::numeric AS paid,
           COALESCE("creditApplied", 0)::numeric AS credit,
           COALESCE("returnedAmount", 0)::numeric AS returned,
           "balanceDue"::numeric AS balance_due
    FROM "Purchase"
    WHERE ABS(total - "paidAmount" - COALESCE("creditApplied", 0) - COALESCE("returnedAmount", 0) - "balanceDue") > 0.02
  `;
    if (balanceMismatches.length === 0) {
        log("Purchase.balanceDue == total - paid - credit - returned", "PASS", `Checked all ${totalPurchases} purchases`);
    } else {
        log("Purchase.balanceDue == total - paid - credit - returned", "FAIL", `${balanceMismatches.length} purchases with balanceDue drift`);
    }
}

// ─────────────────────────────────────────────────────────
// PHASE 1: REGRESSION — Stock invariants
// ─────────────────────────────────────────────────────────
async function phase1_StockInvariants() {
    section("PHASE 1 — Stock Invariants");
    const result = await prisma.$queryRaw`
    SELECT
      p.id, p.name, p."stockQuantity",
      COALESCE(SUM(CASE WHEN sm.type = 'IN' THEN sm.quantity WHEN sm.type = 'OUT' THEN -sm.quantity END), 0)::int AS movement_sum
    FROM "Product" p
    LEFT JOIN "StockMovement" sm ON sm."productId" = p.id
    GROUP BY p.id, p.name, p."stockQuantity"
    HAVING p."stockQuantity" != COALESCE(SUM(CASE WHEN sm.type = 'IN' THEN sm.quantity WHEN sm.type = 'OUT' THEN -sm.quantity END), 0)
  `;
    if (result.length === 0) {
        log("Product.stockQuantity == Sum(StockMovements)", "PASS", "All products in sync");
    } else {
        log("Product.stockQuantity == Sum(StockMovements)", "FAIL", `${result.length} products out of sync`);
        result.forEach(r => console.log(`  Product[${r.id}] ${r.name}: stored=${r.stockQuantity}, movements=${r.movement_sum}`));
    }

    const negativeStock = await prisma.product.findMany({
        where: { stockQuantity: { lt: 0 } },
        select: { id: true, name: true, stockQuantity: true },
    });
    if (negativeStock.length === 0) {
        log("No products with negative stock", "PASS");
    } else {
        log("No products with negative stock", "FAIL", `${negativeStock.length} products negative`);
    }
}

// ─────────────────────────────────────────────────────────
// PHASE 1: REGRESSION — Customer / Supplier ledger invariants
// ─────────────────────────────────────────────────────────
async function phase1_CustomerLedgerInvariants() {
    section("PHASE 1 — Customer Ledger Invariants");
    const result = await prisma.$queryRaw`
    SELECT
      c.id, c.name, c.balance::numeric AS stored_balance,
      COALESCE(SUM(cl.debit) - SUM(cl.credit), 0)::numeric AS ledger_sum
    FROM "Customer" c
    LEFT JOIN "CustomerLedger" cl ON cl."customerId" = c.id
    GROUP BY c.id, c.name, c.balance
    HAVING ABS(c.balance - COALESCE(SUM(cl.debit) - SUM(cl.credit), 0)) > 0.01
  `;
    if (result.length === 0) {
        log("Customer.balance == Sum(CustomerLedger debit-credit)", "PASS", "All customers in sync");
    } else {
        log("Customer.balance == Sum(CustomerLedger debit-credit)", "FAIL", `${result.length} customers drifted`);
        result.forEach(r =>
            console.log(`  Customer[${r.id}] ${r.name}: stored=${Number(r.stored_balance).toFixed(2)}, ledger=${Number(r.ledger_sum).toFixed(2)}`));
    }
}

async function phase1_SupplierLedgerInvariants() {
    section("PHASE 1 — Supplier Ledger Invariants");
    const result = await prisma.$queryRaw`
    SELECT
      s.id, s.name, s.balance::numeric AS stored_balance,
      COALESCE(SUM(sl.credit) - SUM(sl.debit), 0)::numeric AS ledger_sum
    FROM "Supplier" s
    LEFT JOIN "SupplierLedger" sl ON sl."supplierId" = s.id
    GROUP BY s.id, s.name, s.balance
    HAVING ABS(s.balance - COALESCE(SUM(sl.credit) - SUM(sl.debit), 0)) > 0.01
  `;
    if (result.length === 0) {
        log("Supplier.balance == Sum(SupplierLedger credit-debit)", "PASS", "All suppliers in sync");
    } else {
        log("Supplier.balance == Sum(SupplierLedger credit-debit)", "FAIL", `${result.length} suppliers drifted`);
    }
}

// ─────────────────────────────────────────────────────────
// PHASE 2: ADVERSARIAL — static (read-only) checks
// ─────────────────────────────────────────────────────────
async function phase2_DocNumberDuplicates() {
    section("PHASE 2 — Doc Number Duplicates (static check)");
    const dupInvoiceNos = await prisma.$queryRaw`
    SELECT "invoiceNo", COUNT(*) as cnt FROM "Invoice" GROUP BY "invoiceNo" HAVING COUNT(*) > 1
  `;
    if (dupInvoiceNos.length === 0) log("No duplicate invoiceNo in Invoice table", "PASS");
    else log("No duplicate invoiceNo in Invoice table", "FAIL", `${dupInvoiceNos.length} duplicate invoice numbers found`);

    const dupPurchaseNos = await prisma.$queryRaw`
    SELECT "purchaseNo", COUNT(*) as cnt FROM "Purchase" GROUP BY "purchaseNo" HAVING COUNT(*) > 1
  `;
    if (dupPurchaseNos.length === 0) log("No duplicate purchaseNo in Purchase table", "PASS");
    else log("No duplicate purchaseNo in Purchase table", "FAIL", `${dupPurchaseNos.length} duplicate purchase numbers found`);

    if (!MUTATION_TESTS_ENABLED) {
        log("Doc number deletion-collision test", "WARN", "Skipped — requires RUN_MUTATION_TESTS=true (see [BUG-001] probe)");
    }
}

async function phase2_PaymentAllocationIntegrity() {
    section("PHASE 2 — Payment Allocation Integrity");

    const ovAllocated = await prisma.$queryRaw`
    SELECT cp.id, cp.amount::numeric, COALESCE(SUM(pa."amountAllocated"), 0)::numeric AS alloc_sum
    FROM "CustomerPayment" cp
    LEFT JOIN "PaymentAllocation" pa ON pa."customerPaymentId" = cp.id
    GROUP BY cp.id, cp.amount
    HAVING COALESCE(SUM(pa."amountAllocated"), 0) > cp.amount + 0.01
  `;
    if (ovAllocated.length === 0) log("No over-allocated customer payments", "PASS");
    else log("No over-allocated customer payments", "FAIL", `${ovAllocated.length} payments over-allocated`);

    const orphanAllocs = await prisma.$queryRaw`
    SELECT pa.id FROM "PaymentAllocation" pa
    LEFT JOIN "Invoice" i ON i.id = pa."invoiceId"
    WHERE i.id IS NULL
  `;
    if (orphanAllocs.length === 0) log("No orphan PaymentAllocations", "PASS");
    else log("No orphan PaymentAllocations", "FAIL", `${orphanAllocs.length} allocations reference missing invoices`);

    const wrongCustomerAllocs = await prisma.$queryRaw`
    SELECT pa.id FROM "PaymentAllocation" pa
    JOIN "CustomerPayment" cp ON cp.id = pa."customerPaymentId"
    JOIN "Invoice" i ON i.id = pa."invoiceId"
    WHERE cp."customerId" != i."customerId"
  `;
    if (wrongCustomerAllocs.length === 0) log("No cross-customer payment allocations", "PASS");
    else log("No cross-customer payment allocations", "FAIL", `${wrongCustomerAllocs.length} allocations cross customer boundary`);
}

async function phase2_SalesReturnQuantityViolations() {
    section("PHASE 2 — Sales Return Quantity Violations");
    const overReturned = await prisma.$queryRaw`
    SELECT ii."invoiceId", ii."productId", ii.quantity AS sold_qty,
           COALESCE(SUM(sri.quantity), 0)::int AS returned_qty
    FROM "InvoiceItem" ii
    LEFT JOIN "SalesReturn" sr ON sr."invoiceId" = ii."invoiceId"
    LEFT JOIN "SalesReturnItem" sri ON sri."salesReturnId" = sr.id AND sri."productId" = ii."productId"
    GROUP BY ii."invoiceId", ii."productId", ii.quantity
    HAVING COALESCE(SUM(sri.quantity), 0) > ii.quantity
  `;
    if (overReturned.length === 0) log("No over-returned sales return quantities", "PASS");
    else log("No over-returned sales return quantities", "FAIL", `${overReturned.length} items over-returned`);
}

async function phase2_PurchaseReturnQuantityViolations() {
    section("PHASE 2 — Purchase Return Quantity Violations");
    const overReturned = await prisma.$queryRaw`
    SELECT pi2."purchaseId", pi2."productId", pi2.quantity AS purchased_qty,
           COALESCE(SUM(pri.quantity), 0)::int AS returned_qty
    FROM "PurchaseItem" pi2
    LEFT JOIN "PurchaseReturn" pr ON pr."purchaseId" = pi2."purchaseId"
    LEFT JOIN "PurchaseReturnItem" pri ON pri."purchaseReturnId" = pr.id AND pri."productId" = pi2."productId"
    GROUP BY pi2."purchaseId", pi2."productId", pi2.quantity
    HAVING COALESCE(SUM(pri.quantity), 0) > pi2.quantity
  `;
    if (overReturned.length === 0) log("No over-returned purchase return quantities", "PASS");
    else log("No over-returned purchase return quantities", "FAIL", `${overReturned.length} items over-returned`);
}

async function phase2_IdempotencyTableExists() {
    section("PHASE 2 — Idempotency Table");
    try {
        const count = await prisma.idempotencyKey.count();
        log("IdempotencyKey table exists and queryable", "PASS", `${count} keys stored`);
    } catch (err) {
        log("IdempotencyKey table exists and queryable", "FAIL", err.message);
    }
}

// ─────────────────────────────────────────────────────────
// PHASE 3: ACCOUNTING INVARIANTS (read-only)
// ─────────────────────────────────────────────────────────
async function phase3_CashRefundInvariants() {
    section("PHASE 3 — Cash Refund / Store Credit Invariants");

    const noInvoicePositiveBalance = await prisma.$queryRaw`
    SELECT c.id, c.name, c.balance::numeric
    FROM "Customer" c
    WHERE c.balance > 0.01
      AND NOT EXISTS (SELECT 1 FROM "Invoice" i WHERE i."customerId" = c.id AND i."balanceDue" > 0.01)
  `;
    if (noInvoicePositiveBalance.length === 0) {
        log("No customer with positive balance but no open invoices", "PASS");
    } else {
        log("Customers with positive balance but no open invoices", "FAIL",
            `${noInvoicePositiveBalance.length} customers — likely orphaned balance after returns/edits`);
        noInvoicePositiveBalance.forEach(c => console.log(`  Customer[${c.id}] ${c.name}: balance=${Number(c.balance).toFixed(2)}`));
    }

    if (!MUTATION_TESTS_ENABLED) {
        log("Live CASH-refund balanceDue test", "WARN", "Skipped — requires RUN_MUTATION_TESTS=true (see [BUG-002] probe)");
    }
}

async function phase3_COGSHistoricalSnapshot() {
    section("PHASE 3 — COGS Historical Snapshot (costPriceAtSale)");
    // NOTE: costPriceAtSale == 0 is a heuristic proxy for "not populated" — a
    // legitimately free/promotional item would also read 0 and look identical.
    // Treat this as a lead to investigate, not a hard proof either way.
    const zeroCOGS = await prisma.invoiceItem.count({ where: { costPriceAtSale: { equals: 0 } } });
    const totalItems = await prisma.invoiceItem.count();
    if (zeroCOGS === 0) {
        log("All InvoiceItems have non-zero costPriceAtSale", "PASS", `${totalItems} items checked`);
    } else {
        log("Some InvoiceItems have costPriceAtSale=0 (heuristic)", "WARN", `${zeroCOGS}/${totalItems} items`);
    }

    try {
        const srZero = await prisma.salesReturnItem.count({ where: { costPriceAtSale: { equals: 0 } } });
        const srTotal = await prisma.salesReturnItem.count();
        if (srTotal === 0) {
            log("SalesReturnItem.costPriceAtSale check", "WARN", "No SalesReturnItems exist yet to verify");
        } else if (srZero === 0) {
            log("All SalesReturnItems have non-zero costPriceAtSale", "PASS", `${srTotal} items checked`);
        } else {
            log("Some SalesReturnItems have costPriceAtSale=0 (heuristic)", "WARN", `${srZero}/${srTotal} items`);
        }
    } catch (err) {
        log("SalesReturnItem.costPriceAtSale column check", "FAIL", `Column may not exist: ${err.message}`);
    }
}

async function phase3_WACNonNegative() {
    section("PHASE 3 — WAC Non-Negative");
    const negativeWAC = await prisma.product.findMany({
        where: { weightedAvgCost: { lt: 0 } },
        select: { id: true, name: true, weightedAvgCost: true },
    });
    if (negativeWAC.length === 0) log("No products with negative WAC", "PASS");
    else log("Products with negative WAC found", "FAIL", `${negativeWAC.length} products`);
}

// ─────────────────────────────────────────────────────────
// PHASE 4: REPORTING (read-only)
// ─────────────────────────────────────────────────────────
async function phase4_ProfitReportConsistency() {
    section("PHASE 4 — Profit Report SQL Cross-Check");

    const [revenueRes] = await prisma.$queryRaw`SELECT COALESCE(SUM(total), 0)::numeric AS revenue FROM "Invoice"`;
    const [cogsRes] = await prisma.$queryRaw`SELECT COALESCE(SUM(ii."costPriceAtSale" * ii.quantity), 0)::numeric AS cogs FROM "InvoiceItem" ii`;
    const [returnedRevenueRes] = await prisma.$queryRaw`SELECT COALESCE(SUM("totalAmount"), 0)::numeric AS returned_revenue FROM "SalesReturn"`;
    const [returnedCOGSRes] = await prisma.$queryRaw`SELECT COALESCE(SUM(sri."costPriceAtSale" * sri.quantity), 0)::numeric AS returned_cogs FROM "SalesReturnItem" sri`;
    const [expensesRes] = await prisma.$queryRaw`SELECT COALESCE(SUM(amount), 0)::numeric AS expenses FROM "Expense"`;

    const revenue = Number(revenueRes.revenue);
    const cogs = Number(cogsRes.cogs);
    const returnedRevenue = Number(returnedRevenueRes.returned_revenue);
    const returnedCOGS = Number(returnedCOGSRes.returned_cogs);
    const expenses = Number(expensesRes.expenses);

    const netRevenue = revenue - returnedRevenue;
    const netCOGS = cogs - returnedCOGS;
    const grossProfit = netRevenue - netCOGS;
    const netProfit = grossProfit - expenses;

    console.log(`  SQL Net Revenue: Rs. ${netRevenue.toFixed(2)}`);
    console.log(`  SQL Net COGS: Rs. ${netCOGS.toFixed(2)}`);
    console.log(`  SQL Gross Profit: Rs. ${grossProfit.toFixed(2)}`);
    console.log(`  SQL Expenses: Rs. ${expenses.toFixed(2)}`);
    console.log(`  SQL Net Profit: Rs. ${netProfit.toFixed(2)}`);

    try {
        const reportModel = require("../models/report-model");
        const report = await reportModel.netProfitReport("2000-01-01", "2099-12-31");
        const diff = Math.abs(report.netProfit - netProfit);
        if (diff < 1.0) {
            log("netProfitReport() matches manual SQL (within Rs.1)", "PASS", `Report: ${report.netProfit.toFixed(2)}, SQL: ${netProfit.toFixed(2)}`);
        } else {
            log("netProfitReport() vs manual SQL mismatch", "FAIL", `Report: ${report.netProfit.toFixed(2)}, SQL: ${netProfit.toFixed(2)}, diff: ${diff.toFixed(2)}`);
        }
    } catch (err) {
        log("netProfitReport() execution", "FAIL", err.message);
    }
}

async function phase4_ReceivablesPayablesConsistency() {
    section("PHASE 4 — Receivables / Payables Consistency");

    const [recvBal] = await prisma.$queryRaw`SELECT COALESCE(SUM(balance), 0)::numeric AS total FROM "Customer" WHERE balance > 0.01`;
    const [recvInv] = await prisma.$queryRaw`SELECT COALESCE(SUM("balanceDue"), 0)::numeric AS total FROM "Invoice" WHERE "balanceDue" > 0.01`;
    const fromBalance = Number(recvBal.total);
    const fromInvoices = Number(recvInv.total);
    const diff = Math.abs(fromBalance - fromInvoices);
    if (diff < 1.0) {
        log("Receivables: Customer.balance ~= Invoice.balanceDue sum", "PASS", `diff=Rs.${diff.toFixed(2)}`);
    } else {
        log("Receivables: Customer.balance vs Invoice.balanceDue mismatch", "WARN",
            `Customer.balance=${fromBalance.toFixed(2)}, Invoice.balanceDue=${fromInvoices.toFixed(2)}, diff=${diff.toFixed(2)} (may be legitimate store credit)`);
    }

    const [payBal] = await prisma.$queryRaw`SELECT COALESCE(SUM(balance), 0)::numeric AS total FROM "Supplier" WHERE balance > 0.01`;
    const [payPur] = await prisma.$queryRaw`SELECT COALESCE(SUM("balanceDue"), 0)::numeric AS total FROM "Purchase" WHERE "balanceDue" > 0.01`;
    const pFromBalance = Number(payBal.total);
    const pFromPurchases = Number(payPur.total);
    const pdiff = Math.abs(pFromBalance - pFromPurchases);
    if (pdiff < 1.0) {
        log("Payables: Supplier.balance ~= Purchase.balanceDue sum", "PASS", `diff=Rs.${pdiff.toFixed(2)}`);
    } else {
        log("Payables: Supplier.balance vs Purchase.balanceDue mismatch", "WARN",
            `Supplier.balance=${pFromBalance.toFixed(2)}, Purchase.balanceDue=${pFromPurchases.toFixed(2)}, diff=${pdiff.toFixed(2)}`);
    }
}

async function phase4_InventoryValueReport() {
    section("PHASE 4 — Inventory Value (informational — not cross-validated)");
    const [inv] = await prisma.$queryRaw`
    SELECT COALESCE(SUM("stockQuantity"::numeric * "weightedAvgCost"), 0)::numeric AS total_value
    FROM "Product" WHERE "isActive" = true
  `;
    console.log(`  Inventory Value (WAC): Rs. ${Number(inv.total_value).toFixed(2)}`);
    log("Inventory value computed from SQL (no second source to cross-check against)", "PASS", `Rs. ${Number(inv.total_value).toFixed(2)}`);
}

// ─────────────────────────────────────────────────────────
// SYNTHETIC TEST ENTITY SETUP / TEARDOWN — used ONLY by mutation tests
// ─────────────────────────────────────────────────────────
async function setupTestEntities() {
    section("SETUP — Creating isolated synthetic QA test entities");
    const adminUser = await getAdminUser();
    if (!adminUser) throw new Error("No ADMIN user found — cannot run mutation tests");

    const customer = await prisma.customer.create({
        data: { name: "__QA_AUDIT_CUSTOMER__", balance: 0, isActive: true },
    });
    const supplier = await prisma.supplier.create({
        data: { name: "__QA_AUDIT_SUPPLIER__", balance: 0, isActive: true },
    });
    let product = await prisma.product.create({
        data: {
            name: "__QA_AUDIT_PRODUCT__",
            categoryId: 1, // ADAPT: pick a real categoryId if 1 doesn't exist
            costPrice: 100,
            sellingPrice: 150,
            weightedAvgCost: 100,
            stockQuantity: 0,
            isActive: true,
        },
    });

    // Give it real stock through the actual stock model so StockMovement stays in sync
    const stockModel = require("../models/stock-model");
    await stockModel.adjustStock({
        productId: product.id,
        quantity: 100,
        type: "IN",
        referenceType: "ADJUSTMENT",
        referenceId: product.id,
        description: "QA audit synthetic stock setup",
        createdById: adminUser.id,
    });
    product = await prisma.product.findUnique({ where: { id: product.id } });

    log("Synthetic QA test entities created", "PASS",
        `customerId=${customer.id}, supplierId=${supplier.id}, productId=${product.id}`);

    return { customer, supplier, product, adminUser };
}

async function teardownTestEntities({ customer, supplier, product }) {
    section("TEARDOWN — Removing synthetic QA test data");
    if (!customer && !supplier && !product) {
        log("Teardown", "WARN", "Nothing to tear down");
        return;
    }

    // ADAPT: these nested relation filters assume Prisma relation names
    // matching your schema (invoice, salesReturn, purchase, purchaseReturn).
    // Adjust the relation field names if yours differ.
    const steps = [
        ["PaymentAllocation (customer invoices)", () =>
            prisma.paymentAllocation.deleteMany({ where: { invoice: { customerId: customer.id } } })],
        ["CustomerLedger", () => prisma.customerLedger.deleteMany({ where: { customerId: customer.id } })],
        ["SalesReturnItem", () =>
            prisma.salesReturnItem.deleteMany({ where: { salesReturn: { customerId: customer.id } } })],
        ["SalesReturn", () => prisma.salesReturn.deleteMany({ where: { customerId: customer.id } })],
        ["CustomerPayment", () => prisma.customerPayment.deleteMany({ where: { customerId: customer.id } })],
        ["InvoiceItem", () => prisma.invoiceItem.deleteMany({ where: { invoice: { customerId: customer.id } } })],
        ["Invoice", () => prisma.invoice.deleteMany({ where: { customerId: customer.id } })],
        ["PurchaseReturnItem", () =>
            prisma.purchaseReturnItem.deleteMany({ where: { purchaseReturn: { supplierId: supplier.id } } })],
        ["PurchaseReturn", () => prisma.purchaseReturn.deleteMany({ where: { supplierId: supplier.id } })],
        ["SupplierPayment", () =>
            prisma.supplierPayment ? prisma.supplierPayment.deleteMany({ where: { supplierId: supplier.id } }) : Promise.resolve()],
        ["SupplierLedger", () => prisma.supplierLedger.deleteMany({ where: { supplierId: supplier.id } })],
        ["PurchaseItem", () => prisma.purchaseItem.deleteMany({ where: { purchase: { supplierId: supplier.id } } })],
        ["Purchase", () => prisma.purchase.deleteMany({ where: { supplierId: supplier.id } })],
        ["StockMovement", () => prisma.stockMovement.deleteMany({ where: { productId: product.id } })],
        ["Customer record", () => prisma.customer.delete({ where: { id: customer.id } })],
        ["Supplier record", () => prisma.supplier.delete({ where: { id: supplier.id } })],
        ["Product record", () => prisma.product.delete({ where: { id: product.id } })],
    ];

    const failures = [];
    for (const [name, step] of steps) {
        try {
            await step();
        } catch (err) {
            failures.push(`${name}: ${err.message}`);
        }
    }

    if (failures.length === 0) {
        log("Teardown of synthetic QA test entities", "PASS", "All synthetic data removed cleanly");
    } else {
        log("Teardown of synthetic QA test entities", "FAIL",
            `${failures.length} cleanup step(s) failed — manually check and remove leftover __QA_AUDIT_ records: ${failures.join(" | ")}`);
    }
}

// ─────────────────────────────────────────────────────────
// PHASE 5: BUSINESS SIMULATION — runs only against synthetic entities
// ─────────────────────────────────────────────────────────
async function phase5_BusinessSimulation(testEntities) {
    section("PHASE 5 — Business Simulation (Invoice + Payment + Return flow)");
    const { customer, product, adminUser } = testEntities;

    const invoiceModel = require("../models/invoice-model");
    const paymentModel = require("../models/payment-model");
    const salesReturnModel = require("../models/sales-return-model");

    let invoice;
    try {
        invoice = await invoiceModel.createInvoice({
            customerId: customer.id,
            saleType: "CREDIT",
            invoiceDate: new Date(),
            items: [{ productId: product.id, quantity: 1 }],
            paidAmount: 0,
            creditApplied: 0,
            createdById: adminUser.id,
        });
        log("Create credit invoice", "PASS", `Invoice ${invoice.invoiceNo}, total=${Number(invoice.total).toFixed(2)}`);
    } catch (err) {
        log("Create credit invoice", "FAIL", err.message);
        return;
    }

    let payment;
    try {
        payment = await paymentModel.recordCustomerPayment({
            customerId: customer.id,
            allocations: [{ invoiceId: invoice.id, amountAllocated: Number(invoice.total) }],
            amount: Number(invoice.total),
            paymentDate: new Date(),
            createdById: adminUser.id,
        });
        log("Record full customer payment", "PASS", `Payment ${payment.id}, amount=${Number(payment.amount).toFixed(2)}`);
    } catch (err) {
        log("Record full customer payment", "FAIL", err.message);
    }

    const updatedInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
    if (updatedInvoice.status === "PAID" && Math.abs(Number(updatedInvoice.balanceDue)) < 0.01) {
        log("Invoice status PAID after full payment", "PASS");
    } else {
        log("Invoice status PAID after full payment", "FAIL", `status=${updatedInvoice.status}, balanceDue=${updatedInvoice.balanceDue}`);
    }

    try {
        const stockBefore = await prisma.product.findUnique({ where: { id: product.id } });
        const salesReturn = await salesReturnModel.createSalesReturn({
            invoiceId: invoice.id,
            customerId: customer.id,
            returnDate: new Date(),
            items: [{ productId: product.id, quantity: 1 }],
            refundType: "CREDIT",
            createdById: adminUser.id,
        });
        log("Create CREDIT sales return on paid invoice", "PASS", `Return ${salesReturn.returnNo}`);

        const stockAfter = await prisma.product.findUnique({ where: { id: product.id } });
        if (Number(stockAfter.stockQuantity) === Number(stockBefore.stockQuantity) + 1) {
            log("Stock restored after sales return", "PASS");
        } else {
            log("Stock restored after sales return", "FAIL", `before=${stockBefore.stockQuantity}, after=${stockAfter.stockQuantity}`);
        }

        const custAfterReturn = await prisma.customer.findUnique({ where: { id: customer.id } });
        if (Number(custAfterReturn.balance) < 0) {
            log("Customer has store credit after CREDIT return on paid invoice", "PASS", `balance=${Number(custAfterReturn.balance).toFixed(2)}`);
        } else {
            log("Customer store credit after CREDIT return", "WARN", `balance=${Number(custAfterReturn.balance).toFixed(2)}`);
        }
    } catch (err) {
        log("Create CREDIT sales return", "FAIL", err.message);
    }
}

// ─────────────────────────────────────────────────────────
// PHASE 6: RECOVERY — Transaction rollback (synthetic entities only)
// ─────────────────────────────────────────────────────────
async function phase6_TransactionRollback(testEntities) {
    section("PHASE 6 — Transaction Rollback");
    const { customer, product, adminUser } = testEntities;

    const stockBefore = await prisma.product.findUnique({ where: { id: product.id } });
    const invoiceModel = require("../models/invoice-model");

    try {
        await invoiceModel.createInvoice({
            customerId: customer.id,
            saleType: "CREDIT",
            items: [
                { productId: product.id, quantity: 1 },
                { productId: 999999999, quantity: 1 }, // invalid — should force rollback
            ],
            createdById: adminUser.id,
        });
        log("Transaction rollback on invalid product", "FAIL", "Should have thrown but didn't");
    } catch (err) {
        const stockAfter = await prisma.product.findUnique({ where: { id: product.id } });
        if (Number(stockAfter.stockQuantity) === Number(stockBefore.stockQuantity)) {
            log("Transaction rollback on invalid product — stock unchanged", "PASS");
        } else {
            log("Transaction rollback on invalid product — STOCK CORRUPTED", "FAIL",
                `before=${stockBefore.stockQuantity}, after=${stockAfter.stockQuantity}`);
        }
    }
}

// ─────────────────────────────────────────────────────────
// PHASE 7: DATABASE INTEGRITY (read-only)
// ─────────────────────────────────────────────────────────
async function phase7_OrphanChecks() {
    section("PHASE 7 — Database Integrity (Orphan Checks)");

    const checks = [
        ["InvoiceItem", `SELECT COUNT(*)::int AS cnt FROM "InvoiceItem" ii LEFT JOIN "Invoice" i ON i.id = ii."invoiceId" WHERE i.id IS NULL`],
        ["PurchaseItem", `SELECT COUNT(*)::int AS cnt FROM "PurchaseItem" pi2 LEFT JOIN "Purchase" p ON p.id = pi2."purchaseId" WHERE p.id IS NULL`],
        ["SalesReturnItem", `SELECT COUNT(*)::int AS cnt FROM "SalesReturnItem" sri LEFT JOIN "SalesReturn" sr ON sr.id = sri."salesReturnId" WHERE sr.id IS NULL`],
        ["PurchaseReturnItem", `SELECT COUNT(*)::int AS cnt FROM "PurchaseReturnItem" pri LEFT JOIN "PurchaseReturn" pr ON pr.id = pri."purchaseReturnId" WHERE pr.id IS NULL`],
        ["CustomerLedger", `SELECT COUNT(*)::int AS cnt FROM "CustomerLedger" cl LEFT JOIN "Customer" c ON c.id = cl."customerId" WHERE c.id IS NULL`],
        ["SupplierLedger", `SELECT COUNT(*)::int AS cnt FROM "SupplierLedger" sl LEFT JOIN "Supplier" s ON s.id = sl."supplierId" WHERE s.id IS NULL`],
        ["StockMovement", `SELECT COUNT(*)::int AS cnt FROM "StockMovement" sm LEFT JOIN "Product" p ON p.id = sm."productId" WHERE p.id IS NULL`],
    ];

    for (const [name, sql] of checks) {
        const [row] = await prisma.$queryRawUnsafe(sql);
        if (row.cnt === 0) log(`No orphan ${name} rows`, "PASS");
        else log(`Orphan ${name} rows found`, "FAIL", `${row.cnt} orphans`);
    }
}

async function phase7_ImpossibleBalances() {
    section("PHASE 7 — Impossible Balances");

    const negBalanceDueInv = await prisma.invoice.count({ where: { balanceDue: { lt: -0.01 } } });
    if (negBalanceDueInv === 0) log("No invoices with negative balanceDue", "PASS");
    else log("Invoices with negative balanceDue", "FAIL", `${negBalanceDueInv} invoices`);

    const negBalanceDuePur = await prisma.purchase.count({ where: { balanceDue: { lt: -0.01 } } });
    if (negBalanceDuePur === 0) log("No purchases with negative balanceDue", "PASS");
    else log("Purchases with negative balanceDue", "FAIL", `${negBalanceDuePur} purchases`);

    const paidButOwed = await prisma.invoice.count({ where: { status: "PAID", balanceDue: { gt: 0.01 } } });
    if (paidButOwed === 0) log("No PAID invoices with outstanding balanceDue", "PASS");
    else log("PAID invoices with outstanding balanceDue", "FAIL", `${paidButOwed} invoices`);

    const unpaidButCleared = await prisma.invoice.count({ where: { status: "UNPAID", balanceDue: { lt: 0.01 } } });
    if (unpaidButCleared === 0) log("No UNPAID invoices with zero balanceDue", "PASS");
    else log("UNPAID invoices with zero balanceDue", "WARN", `${unpaidButCleared} invoices — status not recalculated`);
}

// ─────────────────────────────────────────────────────────
// PHASE 8: PERFORMANCE SANITY (read-only)
// ─────────────────────────────────────────────────────────
async function phase8_PerformanceSanity() {
    section("PHASE 8 — Performance Sanity");
    const counts = await Promise.all([
        prisma.invoice.count(),
        prisma.purchase.count(),
        prisma.stockMovement.count(),
        prisma.customerLedger.count(),
        prisma.supplierLedger.count(),
    ]);
    console.log(`  Invoices: ${counts[0]}, Purchases: ${counts[1]}`);
    console.log(`  StockMovements: ${counts[2]}, CustomerLedger: ${counts[3]}, SupplierLedger: ${counts[4]}`);

    const start = Date.now();
    await prisma.$queryRaw`
    SELECT COALESCE(SUM(ii."costPriceAtSale" * ii.quantity), 0)::numeric AS cogs
    FROM "InvoiceItem" ii
    JOIN "Invoice" i ON ii."invoiceId" = i.id
  `;
    const elapsed = Date.now() - start;
    if (elapsed < 500) log("COGS aggregate query performance", "PASS", `${elapsed}ms`);
    else if (elapsed < 2000) log("COGS aggregate query performance", "WARN", `${elapsed}ms — acceptable but watch for growth`);
    else log("COGS aggregate query performance", "FAIL", `${elapsed}ms — too slow`);
}

// ─────────────────────────────────────────────────────────
// CRITICAL BUG PROBES — real assertions, synthetic entities only
// ─────────────────────────────────────────────────────────
async function criticalBugProbes(testEntities) {
    section("CRITICAL BUG PROBES — Logic Verification");
    const { customer, supplier, product, adminUser } = testEntities;
    const invoiceModel = require("../models/invoice-model");
    const paymentModel = require("../models/payment-model");
    const purchaseModel = require("../models/purchase-model");
    const salesReturnModel = require("../models/sales-return-model");

    // [BUG-001] Doc number collision after deletion
    try {
        const invA = await invoiceModel.createInvoice({
            customerId: customer.id, saleType: "CREDIT",
            items: [{ productId: product.id, quantity: 1 }],
            paidAmount: 0, creditApplied: 0, createdById: adminUser.id,
        });
        // Simulate a deleted document: remove its children then the invoice itself.
        // ADAPT: referenceType strings assumed to be "INVOICE" — check your schema.
        await prisma.invoiceItem.deleteMany({ where: { invoiceId: invA.id } });
        await prisma.customerLedger.deleteMany({ where: { referenceType: "INVOICE", referenceId: invA.id } }).catch(() => { });
        await prisma.stockMovement.deleteMany({ where: { referenceType: "INVOICE", referenceId: invA.id } }).catch(() => { });
        await prisma.invoice.delete({ where: { id: invA.id } });

        await invoiceModel.createInvoice({
            customerId: customer.id, saleType: "CREDIT",
            items: [{ productId: product.id, quantity: 1 }],
            paidAmount: 0, creditApplied: 0, createdById: adminUser.id,
        });

        const dup = await prisma.$queryRaw`SELECT "invoiceNo", COUNT(*) as cnt FROM "Invoice" GROUP BY "invoiceNo" HAVING COUNT(*) > 1`;
        if (dup.length > 0) {
            log("[BUG-001] Doc number collision after deletion", "FAIL", `Collision confirmed after simulated deletion: ${JSON.stringify(dup)}`);
        } else {
            log("[BUG-001] Doc number collision after deletion", "PASS", "No collision detected after simulated deletion");
        }
    } catch (err) {
        log("[BUG-001] Doc number collision after deletion", "WARN", `Could not complete test: ${err.message}`);
    }

    // [BUG-002] CASH refund keeps Invoice.balanceDue formula consistent
    try {
        const inv = await invoiceModel.createInvoice({
            customerId: customer.id, saleType: "CREDIT",
            items: [{ productId: product.id, quantity: 2 }],
            paidAmount: 0, creditApplied: 0, createdById: adminUser.id,
        });
        const half = Number(inv.total) / 2;
        await paymentModel.recordCustomerPayment({
            customerId: customer.id,
            allocations: [{ invoiceId: inv.id, amountAllocated: half }],
            amount: half, paymentDate: new Date(), createdById: adminUser.id,
        });
        await salesReturnModel.createSalesReturn({
            invoiceId: inv.id, customerId: customer.id, returnDate: new Date(),
            items: [{ productId: product.id, quantity: 1 }],
            refundType: "CASH", createdById: adminUser.id,
        });

        const updated = await prisma.invoice.findUnique({ where: { id: inv.id } });
        const computed = Number(updated.total) - Number(updated.paidAmount) - Number(updated.creditApplied || 0) - Number(updated.returnedAmount || 0);
        const drift = Math.abs(computed - Number(updated.balanceDue));
        if (drift < 0.02) {
            log("[BUG-002] CASH refund keeps Invoice.balanceDue formula consistent", "PASS", `balanceDue=${Number(updated.balanceDue).toFixed(2)}`);
        } else {
            log("[BUG-002] CASH refund keeps Invoice.balanceDue formula consistent", "FAIL",
                `computed=${computed.toFixed(2)}, stored=${Number(updated.balanceDue).toFixed(2)}, drift=${drift.toFixed(2)}`);
        }
    } catch (err) {
        log("[BUG-002] CASH refund keeps Invoice.balanceDue formula consistent", "WARN", `Could not complete test: ${err.message}`);
    }

    // [BUG-003] recordCustomerPayment isCreditApplied logic
    try {
        await prisma.customer.update({ where: { id: customer.id }, data: { balance: 500.0 } });
        const inv = await invoiceModel.createInvoice({
            customerId: customer.id, saleType: "CREDIT",
            items: [{ productId: product.id, quantity: 1 }],
            paidAmount: 0, creditApplied: 0, createdById: adminUser.id,
        });

        try {
            await paymentModel.recordCustomerPayment({
                customerId: customer.id,
                allocations: [{ invoiceId: inv.id, amountAllocated: 50.0 }],
                amount: 50.0, isCreditApplied: true, createdById: adminUser.id,
            });
            log("[BUG-003] isCreditApplied rejects application when customer has no credit", "FAIL",
                "Allowed applying credit when customer has a debt balance (no store credit available)");
        } catch (err) {
            log("[BUG-003] isCreditApplied rejects application when customer has no credit", "PASS", err.message);
        }

        await prisma.customer.update({ where: { id: customer.id }, data: { balance: -200.0 } });
        const payment = await paymentModel.recordCustomerPayment({
            customerId: customer.id,
            allocations: [{ invoiceId: inv.id, amountAllocated: 100.0 }],
            amount: 100.0, isCreditApplied: true, createdById: adminUser.id,
        });
        const ledgerEntry = await prisma.customerLedger.findFirst({
            where: { referenceType: "PAYMENT", referenceId: payment.id },
        });
        if (ledgerEntry && Number(ledgerEntry.debit) === 100.0) {
            log("[BUG-003] isCreditApplied posts a CustomerLedger debit entry", "PASS");
        } else {
            log("[BUG-003] isCreditApplied posts a CustomerLedger debit entry", "FAIL", "Ledger entry missing or wrong amount");
        }
    } catch (err) {
        log("[BUG-003] recordCustomerPayment isCreditApplied test", "WARN", `Could not complete test: ${err.message}`);
    }

    // [BUG-004] recordSupplierPayment isCreditApplied writes a SupplierLedger entry
    try {
        await prisma.supplier.update({ where: { id: supplier.id }, data: { balance: -200.0 } });
        const pur = await purchaseModel.createPurchase({
            supplierId: supplier.id,
            items: [{ productId: product.id, quantity: 1, unitCost: 100.0 }],
            paidAmount: 0, creditApplied: 0, createdById: adminUser.id,
        });
        const payment = await paymentModel.recordSupplierPayment({
            supplierId: supplier.id, purchaseId: pur.id,
            amount: 100.0, isCreditApplied: true, createdById: adminUser.id,
        });
        const ledgerEntry = await prisma.supplierLedger.findFirst({
            where: { referenceType: "PAYMENT", referenceId: payment.id },
        });
        if (ledgerEntry && Number(ledgerEntry.credit) === 100.0) {
            log("[BUG-004] Supplier isCreditApplied writes SupplierLedger credit entry", "PASS");
        } else {
            log("[BUG-004] Supplier isCreditApplied writes SupplierLedger credit entry", "FAIL", "Ledger entry missing or incorrect");
        }
    } catch (err) {
        log("[BUG-004] recordSupplierPayment isCreditApplied test", "WARN", `Could not complete test: ${err.message}`);
    }

    // [BUG-005] SalesReturnItem.costPriceAtSale snapshot check (read-only, global)
    try {
        const srItems = await prisma.salesReturnItem.findMany();
        const missing = srItems.some(item => Number(item.costPriceAtSale) === 0);
        if (srItems.length === 0) {
            log("[BUG-005] SalesReturnItem.costPriceAtSale check", "WARN", "No SalesReturnItems to verify");
        } else if (!missing) {
            log("[BUG-005] SalesReturnItem.costPriceAtSale check", "PASS", "costPriceAtSale is populated on all rows");
        } else {
            log("[BUG-005] SalesReturnItem.costPriceAtSale check", "FAIL", "Some items have costPriceAtSale = 0");
        }
    } catch (err) {
        log("[BUG-005] SalesReturnItem.costPriceAtSale check", "FAIL", err.message);
    }

    // [BUG-007] Dashboard returnedCOGS uses historical cost, not current WAC
    try {
        const reportModel = require("../models/report-model");
        const [manual] = await prisma.$queryRaw`
      SELECT COALESCE(SUM(sri."costPriceAtSale" * sri.quantity), 0)::numeric AS returned_cogs FROM "SalesReturnItem" sri
    `;
        const manualReturnedCOGS = Number(manual.returned_cogs);
        const metrics = await reportModel.getDashboardMetrics();
        // ADAPT: change the field name below to whatever your report-model actually returns
        const dashboardValue = metrics?.returnedCOGS ?? metrics?.monthReturnedCOGS;
        if (dashboardValue === undefined) {
            log("[BUG-007] Dashboard returnedCOGS uses historical cost", "WARN",
                "Could not find a returnedCOGS-like field on getDashboardMetrics() output — update the field name in this test");
        } else {
            const diff = Math.abs(Number(dashboardValue) - manualReturnedCOGS);
            if (diff < 1.0) {
                log("[BUG-007] Dashboard returnedCOGS uses historical cost", "PASS", `dashboard=${Number(dashboardValue).toFixed(2)}, manual=${manualReturnedCOGS.toFixed(2)}`);
            } else {
                log("[BUG-007] Dashboard returnedCOGS uses historical cost", "FAIL",
                    `dashboard=${Number(dashboardValue).toFixed(2)}, manual=${manualReturnedCOGS.toFixed(2)}, diff=${diff.toFixed(2)} — likely using current WAC`);
            }
        }
    } catch (err) {
        log("[BUG-007] Dashboard returnedCOGS uses historical cost", "WARN", `Could not complete test: ${err.message}`);
    }

    // [BUG-008] CASH sale with insufficient paidAmount should be rejected
    try {
        await invoiceModel.createInvoice({
            customerId: customer.id, saleType: "CASH",
            items: [{ productId: product.id, quantity: 1 }],
            paidAmount: 1, creditApplied: 0, createdById: adminUser.id,
        });
        log("[BUG-008] CASH sale with unpaid balanceDue is rejected", "FAIL", "Allowed CASH sale with unpaid balance due");
    } catch (err) {
        log("[BUG-008] CASH sale with unpaid balanceDue is rejected", "PASS", err.message);
    }
}

// ─────────────────────────────────────────────────────────
// FINAL VERDICT
// ─────────────────────────────────────────────────────────
async function finalVerdict() {
    section("FINAL VERDICT");
    console.log(`\n  Total Tests: ${passed + failed + warnings}`);
    console.log(`  ✅ PASSED:   ${passed}`);
    console.log(`  ❌ FAILED:   ${failed}`);
    console.log(`  ⚠️  WARNINGS: ${warnings}`);

    console.log("\n  ─────────────────────────────────────────────────────────────");
    console.log("  BLOCKING ISSUES:");
    console.log("  ─────────────────────────────────────────────────────────────");
    const blocking = results.filter(r => r.status === "FAIL");
    if (blocking.length === 0) {
        console.log("\n  No FAILing checks in this run.");
    } else {
        blocking.forEach((r, i) => {
            console.log(`\n  ${i + 1}. ${r.label}`);
            if (r.detail) console.log(`     └─ ${r.detail}`);
        });
    }

    console.log("\n  ─────────────────────────────────────────────────────────────");
    if (!MUTATION_TESTS_ENABLED) {
        console.log("  NOTE: Mutation-based tests (business simulation, critical bug");
        console.log("  probes) were SKIPPED this run. This verdict only covers");
        console.log("  read-only invariant/integrity checks against your real data.");
        console.log("  Re-run with RUN_MUTATION_TESTS=true for a fuller picture.");
    } else {
        console.log(`  Ready for production based on this run: ${blocking.length === 0 ? "no blocking FAILs found" : "NO — blocking FAILs above"}`);
    }
    console.log("  ─────────────────────────────────────────────────────────────");
}

// ─────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────
async function main() {
    console.log("\n" + "█".repeat(70));
    console.log("  ERP COMPREHENSIVE QA AUDIT");
    console.log(`  Mutation tests: ${MUTATION_TESTS_ENABLED ? "ENABLED (synthetic data, auto-cleanup)" : "DISABLED (read-only)"}`);
    console.log("█".repeat(70) + "\n");

    await safeRun("Phase 1 Invoice Invariants", phase1_InvoiceInvariants);
    await safeRun("Phase 1 Purchase Invariants", phase1_PurchaseInvariants);
    await safeRun("Phase 1 Stock Invariants", phase1_StockInvariants);
    await safeRun("Phase 1 Customer Ledger", phase1_CustomerLedgerInvariants);
    await safeRun("Phase 1 Supplier Ledger", phase1_SupplierLedgerInvariants);
    await safeRun("Phase 2 Doc Number Duplicates", phase2_DocNumberDuplicates);
    await safeRun("Phase 2 Payment Allocation Integrity", phase2_PaymentAllocationIntegrity);
    await safeRun("Phase 2 Sales Return Qty", phase2_SalesReturnQuantityViolations);
    await safeRun("Phase 2 Purchase Return Qty", phase2_PurchaseReturnQuantityViolations);
    await safeRun("Phase 2 Idempotency Table", phase2_IdempotencyTableExists);
    await safeRun("Phase 3 Cash Refund Invariants", phase3_CashRefundInvariants);
    await safeRun("Phase 3 COGS Snapshot", phase3_COGSHistoricalSnapshot);
    await safeRun("Phase 3 WAC Non-Negative", phase3_WACNonNegative);
    await safeRun("Phase 4 Profit Consistency", phase4_ProfitReportConsistency);
    await safeRun("Phase 4 Receivables/Payables", phase4_ReceivablesPayablesConsistency);
    await safeRun("Phase 4 Inventory Value", phase4_InventoryValueReport);

    if (MUTATION_TESTS_ENABLED) {
        let testEntities = null;
        try {
            testEntities = await setupTestEntities();
            await safeRun("Phase 5 Business Simulation", () => phase5_BusinessSimulation(testEntities));
            await safeRun("Phase 6 Transaction Rollback", () => phase6_TransactionRollback(testEntities));
            await safeRun("Critical Bug Probes", () => criticalBugProbes(testEntities));
        } finally {
            if (testEntities) await teardownTestEntities(testEntities);
        }
    } else {
        log("Phase 5 Business Simulation", "WARN", "Skipped — set RUN_MUTATION_TESTS=true to enable");
        log("Phase 6 Transaction Rollback", "WARN", "Skipped — set RUN_MUTATION_TESTS=true to enable");
        log("Critical Bug Probes", "WARN", "Skipped — set RUN_MUTATION_TESTS=true to enable");
    }

    await safeRun("Phase 7 Orphan Checks", phase7_OrphanChecks);
    await safeRun("Phase 7 Impossible Balances", phase7_ImpossibleBalances);
    await safeRun("Phase 8 Performance Sanity", phase8_PerformanceSanity);
    await finalVerdict();
}

main()
    .catch(err => {
        console.error("FATAL:", err);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());