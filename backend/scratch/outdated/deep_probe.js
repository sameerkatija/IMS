/**
 * Deep probe: Edge cases that only surface after complex multi-step flows.
 * Uses a RUN_ID timestamp so SKU/phone values are unique on every run.
 */
require("dotenv").config();
const prisma = require("../config/prisma");
const invoiceModel = require("../models/invoice-model");
const paymentModel = require("../models/payment-model");
const salesReturnModel = require("../models/sales-return-model");
const purchaseModel = require("../models/purchase-model");
const stockModel = require("../models/stock-model");
const ledgerModel = require("../models/ledger-model");
const reportModel = require("../models/report-model");

let passed = 0, failed = 0;
const bugs = [];
const R = Date.now() % 1000000; // short unique suffix per run

function ok(label) { console.log(`  ✓ ${label}`); passed++; }
function bug(label, detail) {
  console.error(`  ✗ BUG: ${label}`);
  console.error(`        ${detail}`);
  failed++;
  bugs.push({ label, detail });
}
function check(label, cond, detail) { if (cond) ok(label); else bug(label, detail); }

async function cleanup(ids) {
  const { cids = [], sids = [], pids = [] } = ids;
  if (cids.length) {
    await prisma.paymentAllocation.deleteMany({ where: { invoice: { customerId: { in: cids } } } });
    await prisma.customerLedger.deleteMany({ where: { customerId: { in: cids } } });
    await prisma.customerPayment.deleteMany({ where: { customerId: { in: cids } } });
    await prisma.salesReturnItem.deleteMany({ where: { salesReturn: { customerId: { in: cids } } } });
    await prisma.salesReturn.deleteMany({ where: { customerId: { in: cids } } });
    await prisma.invoiceItem.deleteMany({ where: { invoice: { customerId: { in: cids } } } });
    await prisma.invoice.deleteMany({ where: { customerId: { in: cids } } });
    await prisma.customer.deleteMany({ where: { id: { in: cids } } });
  }
  if (sids.length) {
    await prisma.supplierLedger.deleteMany({ where: { supplierId: { in: sids } } });
    await prisma.supplierPayment.deleteMany({ where: { supplierId: { in: sids } } });
    await prisma.purchaseReturnItem.deleteMany({ where: { purchaseReturn: { supplierId: { in: sids } } } });
    await prisma.purchaseReturn.deleteMany({ where: { supplierId: { in: sids } } });
    await prisma.purchaseItem.deleteMany({ where: { purchase: { supplierId: { in: sids } } } });
    await prisma.purchase.deleteMany({ where: { supplierId: { in: sids } } });
    await prisma.supplier.deleteMany({ where: { id: { in: sids } } });
  }
  if (pids.length) {
    await prisma.stockAdjustment.deleteMany({ where: { productId: { in: pids } } });
    await prisma.stockMovement.deleteMany({ where: { productId: { in: pids } } });
    await prisma.product.deleteMany({ where: { id: { in: pids } } });
  }
}

async function mkProd(n, cat) {
  return prisma.product.create({ data: {
    name: `Probe-${R}-${n}`, sku: `PRB${R}${n}`, stockQuantity: 0,
    costPrice: 50, sellingPrice: 100, weightedAvgCost: 50, categoryId: cat.id
  }});
}
async function mkSupp(n) {
  return prisma.supplier.create({ data: { name: `SupProbe${R}${n}`, phone: `0300${R}${n}`, balance: 0 }});
}
async function mkCust(n) {
  return prisma.customer.create({ data: { name: `CustProbe${R}${n}`, phone: `0311${R}${n}`, balance: 0 }});
}

async function main() {
  const user = await prisma.user.findFirst();
  const cat = await prisma.category.findFirst();
  console.log("=== DEEP EDGE CASE PROBE ===\n");

  // ─── Probe 1: CASH return on fully-paid CASH invoice ────────────────────────
  {
    console.log("--- Probe 1: CASH return on fully-paid CASH invoice ---");
    const prod = await mkProd("P1", cat);
    const supp = await mkSupp("1");
    const cust = await mkCust("1");

    await purchaseModel.createPurchase({
      supplierId: supp.id,
      items: [{ productId: prod.id, quantity: 20, unitCost: 50 }],
      createdById: user.id
    });

    const inv = await invoiceModel.createInvoice({
      customerId: cust.id, saleType: "CASH",
      paidAmount: 1000, creditApplied: 0, discount: 0,
      items: [{ productId: prod.id, quantity: 10, unitPrice: 100 }],
      createdById: user.id
    });
    const custBefore = await prisma.customer.findUnique({ where: { id: cust.id } });
    check(`Probe 1: Customer balance = 0 for fully paid CASH invoice`, Number(custBefore.balance) === 0, `balance=${custBefore.balance}`);

    await salesReturnModel.createSalesReturn({
      invoiceId: inv.id, reason: "Probe", refundType: "CASH",
      items: [{ productId: prod.id, quantity: 3 }],
      createdById: user.id
    });

    const custAfter = await prisma.customer.findUnique({ where: { id: cust.id } });
    const invAfter = await prisma.invoice.findUnique({ where: { id: inv.id } });
    check(`Probe 1: Invoice balanceDue unchanged after CASH return`, Math.abs(Number(invAfter.balanceDue)) < 0.01, `balanceDue=${invAfter.balanceDue}`);
    check(`Probe 1: Customer balance = 0 after CASH return (ledger neutral)`, Math.abs(Number(custAfter.balance)) < 0.01, `balance=${custAfter.balance}`);

    const ledgerEntries = await prisma.customerLedger.findMany({ where: { customerId: cust.id } });
    console.log(`    Note: CASH sale return created ${ledgerEntries.length} ledger entries (credit+debit = neutral)`);

    await cleanup({ cids: [cust.id], sids: [supp.id], pids: [prod.id] });
  }

  // ─── Probe 2: CASH return on partially-paid CREDIT invoice ───────────────────
  {
    console.log("--- Probe 2: CASH return on partially-paid CREDIT invoice ---");
    const prod = await mkProd("P2", cat);
    const supp = await mkSupp("2");
    const cust = await mkCust("2");

    await purchaseModel.createPurchase({
      supplierId: supp.id,
      items: [{ productId: prod.id, quantity: 50, unitCost: 50 }],
      createdById: user.id
    });

    const inv = await invoiceModel.createInvoice({
      customerId: cust.id, saleType: "CREDIT",
      paidAmount: 0, creditApplied: 0, discount: 0,
      items: [{ productId: prod.id, quantity: 10, unitPrice: 100 }],
      createdById: user.id
    });

    await paymentModel.recordCustomerPayment({
      customerId: cust.id,
      allocations: [{ invoiceId: inv.id, amountAllocated: 600 }],
      amount: 600, createdById: user.id
    });

    await salesReturnModel.createSalesReturn({
      invoiceId: inv.id, reason: "Probe", refundType: "CASH",
      items: [{ productId: prod.id, quantity: 2 }],
      createdById: user.id
    });

    const invFinal = await prisma.invoice.findUnique({ where: { id: inv.id } });
    const custFinal = await prisma.customer.findUnique({ where: { id: cust.id } });
    check(`Probe 2: inv.balanceDue still 400 after CASH return`, Math.abs(Number(invFinal.balanceDue) - 400) < 0.01, `balanceDue=${invFinal.balanceDue}`);
    check(`Probe 2: customer.balance still 400 after CASH return`, Math.abs(Number(custFinal.balance) - 400) < 0.01, `balance=${custFinal.balance}`);

    const rec = await ledgerModel.reconcileCustomerLedger(cust.id);
    check(`Probe 2: Ledger reconciles cleanly`, rec.inSync, `drift=${rec.drift}`);

    await cleanup({ cids: [cust.id], sids: [supp.id], pids: [prod.id] });
  }

  // ─── Probe 3: Damaged stock adjustment creates expense ───────────────────────
  {
    console.log("--- Probe 3: Damaged stock adjustment creates expense ---");
    const prod = await prisma.product.create({ data: {
      name: `Probe-${R}-P3`, sku: `PRB${R}P3`, stockQuantity: 0,
      costPrice: 50, sellingPrice: 100, weightedAvgCost: 60, categoryId: cat.id
    }});
    const supp = await mkSupp("3");

    await purchaseModel.createPurchase({
      supplierId: supp.id,
      items: [{ productId: prod.id, quantity: 20, unitCost: 60 }],
      createdById: user.id
    });

    const expensesBefore = await prisma.expense.count();
    const adj = await stockModel.createAdjustment({
      productId: prod.id, quantity: -5, reason: "Damaged",
      description: "5 units damaged in warehouse", createdById: user.id
    });
    const expensesAfter = await prisma.expense.count();
    check(`Probe 3: Damaged stock adjustment creates 1 expense`, expensesAfter === expensesBefore + 1, `before=${expensesBefore}, after=${expensesAfter}`);

    const expenseEntry = await prisma.expense.findFirst({
      where: { description: { contains: "Inventory Adjustment" } },
      orderBy: { createdAt: "desc" }
    });
    check(`Probe 3: Expense amount = 300 (5 × 60 WAC)`, Math.abs(Number(expenseEntry?.amount) - 300) < 0.01, `amount=${expenseEntry?.amount}`);

    // Recount should NOT create expense
    const expBeforeRecount = await prisma.expense.count();
    await stockModel.createAdjustment({
      productId: prod.id, quantity: 2, reason: "Recount",
      description: "Recount found 2 more units", createdById: user.id
    });
    const expAfterRecount = await prisma.expense.count();
    check(`Probe 3: Recount adjustment does NOT create expense`, expAfterRecount === expBeforeRecount, `before=${expBeforeRecount}, after=${expAfterRecount}`);

    // Cleanup expense category data
    const expCat = await prisma.expenseCategory.findFirst({ where: { name: "inventory loss/shrinkage" } });
    if (expCat) await prisma.expense.deleteMany({ where: { categoryId: expCat.id } });
    await cleanup({ sids: [supp.id], pids: [prod.id] });
  }

  // ─── Probe 4: Advance general payment → later allocation ────────────────────
  {
    console.log("--- Probe 4: Advance payment then allocation ---");
    const prod = await mkProd("P4", cat);
    const supp = await mkSupp("4");
    const cust = await mkCust("4");

    await purchaseModel.createPurchase({
      supplierId: supp.id,
      items: [{ productId: prod.id, quantity: 30, unitCost: 50 }],
      createdById: user.id
    });

    const inv = await invoiceModel.createInvoice({
      customerId: cust.id, saleType: "CREDIT",
      paidAmount: 0, creditApplied: 0, discount: 0,
      items: [{ productId: prod.id, quantity: 10, unitPrice: 100 }],
      createdById: user.id
    });

    // General payment Rs.500 — no allocation yet
    const genPay = await paymentModel.recordCustomerPayment({
      customerId: cust.id, amount: 500, createdById: user.id
    });
    const custAfterPay = await prisma.customer.findUnique({ where: { id: cust.id } });
    check(`Probe 4: Customer balance = 500 after advance payment`, Math.abs(Number(custAfterPay.balance) - 500) < 0.01, `balance=${custAfterPay.balance}`);

    // Allocate Rs.400 to the invoice
    await paymentModel.allocateCustomerPayment({
      customerPaymentId: genPay.id,
      allocations: [{ invoiceId: inv.id, amountAllocated: 400 }]
    });

    const invAfterAlloc = await prisma.invoice.findUnique({ where: { id: inv.id } });
    check(`Probe 4: Invoice balanceDue = 600 after Rs.400 allocation`, Math.abs(Number(invAfterAlloc.balanceDue) - 600) < 0.01, `balanceDue=${invAfterAlloc.balanceDue}`);

    const custAfterAlloc = await prisma.customer.findUnique({ where: { id: cust.id } });
    check(`Probe 4: Customer balance still 500 after allocation (ledger not re-posted)`, Math.abs(Number(custAfterAlloc.balance) - 500) < 0.01, `balance=${custAfterAlloc.balance}`);

    const rec = await ledgerModel.reconcileCustomerLedger(cust.id);
    check(`Probe 4: Ledger reconciles after advance payment + allocation`, rec.inSync, `drift=${rec.drift}`);

    await cleanup({ cids: [cust.id], sids: [supp.id], pids: [prod.id] });
  }

  // ─── Probe 5: customer.balance vs invoice outstanding after full allocation ───
  {
    console.log("--- Probe 5: customer.balance == sum(invoiceBalanceDue) after full allocation ---");
    const prod = await mkProd("P5", cat);
    const supp = await mkSupp("5");
    const cust = await mkCust("5");

    await purchaseModel.createPurchase({
      supplierId: supp.id,
      items: [{ productId: prod.id, quantity: 50, unitCost: 50 }],
      createdById: user.id
    });

    const inv1 = await invoiceModel.createInvoice({
      customerId: cust.id, saleType: "CREDIT",
      paidAmount: 0, creditApplied: 0, discount: 0,
      items: [{ productId: prod.id, quantity: 5, unitPrice: 100 }],
      createdById: user.id
    });
    const inv2 = await invoiceModel.createInvoice({
      customerId: cust.id, saleType: "CREDIT",
      paidAmount: 0, creditApplied: 0, discount: 0,
      items: [{ productId: prod.id, quantity: 5, unitPrice: 100 }],
      createdById: user.id
    });
    // customer.balance = 1000

    const genPay = await paymentModel.recordCustomerPayment({
      customerId: cust.id, amount: 800, createdById: user.id
    });

    await paymentModel.allocateCustomerPayment({
      customerPaymentId: genPay.id,
      allocations: [
        { invoiceId: inv1.id, amountAllocated: 500 },
        { invoiceId: inv2.id, amountAllocated: 300 }
      ]
    });

    const inv1After = await prisma.invoice.findUnique({ where: { id: inv1.id } });
    const inv2After = await prisma.invoice.findUnique({ where: { id: inv2.id } });
    const totalOut = Number(inv1After.balanceDue) + Number(inv2After.balanceDue);
    const custFinal = await prisma.customer.findUnique({ where: { id: cust.id } });

    console.log(`    customer.balance = ${custFinal.balance}, totalInvoiceOut = ${totalOut}`);
    check(`Probe 5: customer.balance == sum(invoice.balanceDue) after full allocation`,
      Math.abs(Number(custFinal.balance) - totalOut) < 0.01,
      `balance=${custFinal.balance}, invoiceOut=${totalOut}`
    );

    await cleanup({ cids: [cust.id], sids: [supp.id], pids: [prod.id] });
  }

  // ─── Probe 6: Concurrent payments to same invoice ───────────────────────────
  {
    console.log("--- Probe 6: Concurrent payments to same invoice ---");
    const prod = await mkProd("P6", cat);
    const supp = await mkSupp("6");
    const cust = await mkCust("6");

    await purchaseModel.createPurchase({
      supplierId: supp.id,
      items: [{ productId: prod.id, quantity: 20, unitCost: 50 }],
      createdById: user.id
    });

    const inv = await invoiceModel.createInvoice({
      customerId: cust.id, saleType: "CREDIT",
      paidAmount: 0, creditApplied: 0, discount: 0,
      items: [{ productId: prod.id, quantity: 10, unitPrice: 100 }],
      createdById: user.id
    });

    const [r1, r2] = await Promise.allSettled([
      paymentModel.recordCustomerPayment({
        customerId: cust.id, amount: 700,
        allocations: [{ invoiceId: inv.id, amountAllocated: 700 }],
        createdById: user.id
      }),
      paymentModel.recordCustomerPayment({
        customerId: cust.id, amount: 700,
        allocations: [{ invoiceId: inv.id, amountAllocated: 700 }],
        createdById: user.id
      }),
    ]);

    const bothOk = r1.status === "fulfilled" && r2.status === "fulfilled";
    check(
      `Probe 6: Concurrent Rs.700 payments on Rs.1000 invoice — at least one rejected`,
      !bothOk,
      bothOk ? "CRITICAL: Both succeeded — invoice could go negative!" : "Correct: one payment rejected"
    );

    const invFinal = await prisma.invoice.findUnique({ where: { id: inv.id } });
    check(`Probe 6: Invoice balanceDue >= 0`, Number(invFinal.balanceDue) >= -0.01, `balanceDue=${invFinal.balanceDue}`);

    await cleanup({ cids: [cust.id], sids: [supp.id], pids: [prod.id] });
  }

  // ─── Probe 7: Discount precision with repeating decimals ─────────────────────
  {
    console.log("--- Probe 7: Discount precision ---");
    const prod = await prisma.product.create({ data: {
      name: `Probe-${R}-P7`, sku: `PRB${R}P7`, stockQuantity: 0,
      costPrice: 10, sellingPrice: 33.33, weightedAvgCost: 10, categoryId: cat.id
    }});
    const supp = await mkSupp("7");
    const cust = await mkCust("7");

    await purchaseModel.createPurchase({
      supplierId: supp.id,
      items: [{ productId: prod.id, quantity: 100, unitCost: 10 }],
      createdById: user.id
    });

    const inv = await invoiceModel.createInvoice({
      customerId: cust.id, saleType: "CREDIT",
      paidAmount: 0, creditApplied: 0, discount: 10,
      items: [
        { productId: prod.id, quantity: 1, unitPrice: 33.33 },
        { productId: prod.id, quantity: 1, unitPrice: 33.33 },
        { productId: prod.id, quantity: 1, unitPrice: 33.33 },
      ],
      createdById: user.id
    });

    const invItems = await prisma.invoiceItem.findMany({ where: { invoiceId: inv.id } });
    const itemTotalSum = invItems.reduce((s, i) => s + Number(i.totalPrice), 0);
    console.log(`    inv.total=${inv.total}, sum(itemTotalPrice)=${itemTotalSum.toFixed(4)}, drift=${Math.abs(Number(inv.total) - itemTotalSum).toFixed(4)}`);
    check(`Probe 7: sum(itemTotalPrice) within Rs.0.10 of invoice.total`,
      Math.abs(Number(inv.total) - itemTotalSum) < 0.10,
      `inv.total=${inv.total}, itemSum=${itemTotalSum}`
    );

    await cleanup({ cids: [cust.id], sids: [supp.id], pids: [prod.id] });
  }

  // ─── Probe 8: WAC accumulation precision over 5 batches ──────────────────────
  {
    console.log("--- Probe 8: WAC accumulation precision ---");
    const prod = await prisma.product.create({ data: {
      name: `Probe-${R}-P8`, sku: `PRB${R}P8`, stockQuantity: 0,
      costPrice: 50, sellingPrice: 100, weightedAvgCost: 0, categoryId: cat.id
    }});
    const supp = await mkSupp("8");

    const batches = [
      { qty: 10, cost: 50 },
      { qty: 20, cost: 60 },
      { qty: 5,  cost: 70 },
      { qty: 15, cost: 55 },
      { qty: 25, cost: 65 },
    ];
    let rQty = 0, rCost = 0;
    for (const b of batches) {
      await purchaseModel.createPurchase({
        supplierId: supp.id,
        items: [{ productId: prod.id, quantity: b.qty, unitCost: b.cost }],
        createdById: user.id
      });
      rCost = rQty * rCost + b.qty * b.cost;
      rQty += b.qty;
      rCost /= rQty;
    }

    const prodFinal = await prisma.product.findUnique({ where: { id: prod.id } });
    check(`Probe 8: WAC = ${rCost.toFixed(4)} after 5 batches`,
      Math.abs(Number(prodFinal.weightedAvgCost) - rCost) < 0.01,
      `WAC=${prodFinal.weightedAvgCost}, expected=${rCost}`
    );
    check(`Probe 8: stockQuantity = 75 after 5 purchases`, prodFinal.stockQuantity === 75, `qty=${prodFinal.stockQuantity}`);

    await cleanup({ sids: [supp.id], pids: [prod.id] });
  }

  // ─── Probe 9: Invoice status transitions ─────────────────────────────────────
  {
    console.log("--- Probe 9: Invoice status transitions ---");
    const prod = await mkProd("P9", cat);
    const supp = await mkSupp("9");
    const cust = await mkCust("9");

    await purchaseModel.createPurchase({
      supplierId: supp.id,
      items: [{ productId: prod.id, quantity: 20, unitCost: 50 }],
      createdById: user.id
    });

    const inv = await invoiceModel.createInvoice({
      customerId: cust.id, saleType: "CREDIT",
      paidAmount: 0, creditApplied: 0, discount: 0,
      items: [{ productId: prod.id, quantity: 10, unitPrice: 100 }],
      createdById: user.id
    });
    check(`Probe 9: New invoice status = UNPAID`, inv.status === "UNPAID", `status=${inv.status}`);

    await paymentModel.recordCustomerPayment({
      customerId: cust.id,
      allocations: [{ invoiceId: inv.id, amountAllocated: 500 }],
      amount: 500, createdById: user.id
    });
    const invP = await prisma.invoice.findUnique({ where: { id: inv.id } });
    check(`Probe 9: After partial payment, status = PARTIALLY_PAID`, invP.status === "PARTIALLY_PAID", `status=${invP.status}`);

    await paymentModel.recordCustomerPayment({
      customerId: cust.id,
      allocations: [{ invoiceId: inv.id, amountAllocated: 500 }],
      amount: 500, createdById: user.id
    });
    const invF = await prisma.invoice.findUnique({ where: { id: inv.id } });
    check(`Probe 9: After full payment, status = PAID`, invF.status === "PAID", `status=${invF.status}`);
    check(`Probe 9: After full payment, balanceDue = 0`, Math.abs(Number(invF.balanceDue)) < 0.01, `balanceDue=${invF.balanceDue}`);

    await cleanup({ cids: [cust.id], sids: [supp.id], pids: [prod.id] });
  }

  // ─── Probe 10: Sale below cost is blocked ────────────────────────────────────
  {
    console.log("--- Probe 10: Sale at below-cost price blocked ---");
    const prod = await mkProd("PA", cat);
    const supp = await mkSupp("A");
    const cust = await mkCust("A");

    await purchaseModel.createPurchase({
      supplierId: supp.id,
      items: [{ productId: prod.id, quantity: 10, unitCost: 80 }], // WAC = 80
      createdById: user.id
    });

    try {
      await invoiceModel.createInvoice({
        customerId: cust.id, saleType: "CASH",
        paidAmount: 0, creditApplied: 0, discount: 0,
        items: [{ productId: prod.id, quantity: 5, unitPrice: 50 }], // selling at 50 < cost 80
        createdById: user.id
      });
      // The model blocks: net total (5×50=250) < totalCost (5×80=400)
      bug("Probe 10: Sale below cost should be blocked", "Succeeded but should have failed");
    } catch (e) {
      check(`Probe 10: Sale below cost is rejected`, e.message.includes("cost price") || e.message.includes("too high"), `Error: ${e.message}`);
    }

    await cleanup({ cids: [cust.id], sids: [supp.id], pids: [prod.id] });
  }

  // ─── Probe 11: refundCustomerCreditBalance ────────────────────────────────────
  {
    console.log("--- Probe 11: Cash refund of store credit balance ---");
    const prod = await mkProd("PB", cat);
    const supp = await mkSupp("B");
    const cust = await mkCust("B");

    await purchaseModel.createPurchase({
      supplierId: supp.id,
      items: [{ productId: prod.id, quantity: 20, unitCost: 50 }],
      createdById: user.id
    });

    const inv = await invoiceModel.createInvoice({
      customerId: cust.id, saleType: "CREDIT",
      paidAmount: 0, creditApplied: 0, discount: 0,
      items: [{ productId: prod.id, quantity: 5, unitPrice: 100 }],
      createdById: user.id
    });
    // balance = 500

    // Fully pay the invoice
    await paymentModel.recordCustomerPayment({
      customerId: cust.id,
      allocations: [{ invoiceId: inv.id, amountAllocated: 500 }],
      amount: 500, createdById: user.id
    });

    const custAfterPay = await prisma.customer.findUnique({ where: { id: cust.id } });
    check(`Probe 11: Customer balance = 0 after full payment`, Math.abs(Number(custAfterPay.balance)) < 0.01, `balance=${custAfterPay.balance}`);

    // Do a CREDIT return — creates store credit (customer balance goes negative)
    await salesReturnModel.createSalesReturn({
      invoiceId: inv.id, reason: "Full return", refundType: "CREDIT",
      items: [{ productId: prod.id, quantity: 5 }],
      createdById: user.id
    });
    const custAfterReturn = await prisma.customer.findUnique({ where: { id: cust.id } });
    // After CREDIT return of 500, customer.balance = -500 (we owe them)
    check(`Probe 11: Customer balance = -500 after full CREDIT return`, Math.abs(Number(custAfterReturn.balance) - (-500)) < 0.01, `balance=${custAfterReturn.balance}`);

    // Cannot refund more than store credit
    try {
      await paymentModel.refundCustomerCreditBalance({
        customerId: cust.id, amount: 600, createdById: user.id
      });
      bug("Probe 11: Refund > credit balance should be rejected", "Succeeded");
    } catch (e) {
      check(`Probe 11: Refund > credit balance rejected`, e.message.includes("exceeds"), `Error: ${e.message}`);
    }

    // Refund exact credit balance
    await paymentModel.refundCustomerCreditBalance({
      customerId: cust.id, amount: 500, createdById: user.id
    });
    const custAfterRefund = await prisma.customer.findUnique({ where: { id: cust.id } });
    check(`Probe 11: Customer balance = 0 after cash refund of store credit`, Math.abs(Number(custAfterRefund.balance)) < 0.01, `balance=${custAfterRefund.balance}`);

    const rec = await ledgerModel.reconcileCustomerLedger(cust.id);
    check(`Probe 11: Ledger reconciles after complete store credit cycle`, rec.inSync, `drift=${rec.drift}`);

    await cleanup({ cids: [cust.id], sids: [supp.id], pids: [prod.id] });
  }

  // ─── Probe 12: Invoice with creditApplied on new invoice ─────────────────────
  {
    console.log("--- Probe 12: Invoice with creditApplied from store credit ---");
    const prod = await mkProd("PC", cat);
    const supp = await mkSupp("C");
    const cust = await mkCust("C");

    await purchaseModel.createPurchase({
      supplierId: supp.id,
      items: [{ productId: prod.id, quantity: 50, unitCost: 50 }],
      createdById: user.id
    });

    // Create first invoice
    const inv1 = await invoiceModel.createInvoice({
      customerId: cust.id, saleType: "CREDIT",
      paidAmount: 0, creditApplied: 0, discount: 0,
      items: [{ productId: prod.id, quantity: 5, unitPrice: 100 }],
      createdById: user.id
    });
    // balance = 500, inv1.balanceDue = 500

    // Pay inv1 fully
    await paymentModel.recordCustomerPayment({
      customerId: cust.id,
      allocations: [{ invoiceId: inv1.id, amountAllocated: 500 }],
      amount: 500, createdById: user.id
    });

    // Return ALL units → CREDIT store credit: balance = -500 (we owe them)
    await salesReturnModel.createSalesReturn({
      invoiceId: inv1.id, reason: "Full return", refundType: "CREDIT",
      items: [{ productId: prod.id, quantity: 5 }],
      createdById: user.id
    });
    const custAfterReturn = await prisma.customer.findUnique({ where: { id: cust.id } });
    check(`Probe 12: Customer balance = -500 after full return (store credit)`, Math.abs(Number(custAfterReturn.balance) - (-500)) < 0.01, `balance=${custAfterReturn.balance}`);

    // Create new invoice applying Rs. 300 of store credit
    const inv2 = await invoiceModel.createInvoice({
      customerId: cust.id, saleType: "CREDIT",
      paidAmount: 0, creditApplied: 300, discount: 0,
      items: [{ productId: prod.id, quantity: 10, unitPrice: 100 }],
      createdById: user.id
    });
    // total = 1000, creditApplied = 300, balanceDue = 700
    // After invoice: customer.balance should be -500 + 1000 - 300 = 200 (debit 1000 from invoice, credit 300 would be balance reduction...)
    // Wait - let's trace:
    // createInvoice with creditApplied > 0: ledger debit = total = 1000 (no credit entry for creditApplied in createInvoice)
    // customer.balance += 1000 → -500 + 1000 = 500
    // But balanceDue = 700, creditApplied = 300
    // The creditApplied DOES NOT post a ledger credit entry in createInvoice!
    // It only reduces balanceDue on the invoice, but doesn't post a ledger credit.
    // This means: customer.balance (500) != expected (200).
    // This is a potential issue if creditApplied on new invoice doesn't also reverse the prior credit.
    
    const custAfterInv2 = await prisma.customer.findUnique({ where: { id: cust.id } });
    const inv2Data = await prisma.invoice.findUnique({ where: { id: inv2.id } });
    
    console.log(`    Before inv2: customer.balance=-500`);
    console.log(`    After inv2 (creditApplied=300): customer.balance=${custAfterInv2.balance}`);
    console.log(`    inv2.balanceDue=${inv2Data.balanceDue}, inv2.total=${inv2Data.total}, inv2.creditApplied=${inv2Data.creditApplied}`);
    
    // customer.balance = -500 (store credit) + 1000 (inv2 debit) - 300 (credit consumed) = 200
    // This is the correct NET position: customer owes us 200 (700 invoice - 500 store credit they had)
    // inv2.balanceDue=700 represents the invoice amount minus creditApplied (1000-300)
    // The remaining 200 unused credit is captured in customer.balance = 200
    const expectedBalance = -500 + 1000 - 300; // = 200
    check(`Probe 12: customer.balance = ${expectedBalance} (net: inv_total - credit_consumed - prior_credit)`,
      Math.abs(Number(custAfterInv2.balance) - expectedBalance) < 0.01,
      `customer.balance=${custAfterInv2.balance}, expected=${expectedBalance}`
    );

    // Ledger should reconcile cleanly
    const rec = await ledgerModel.reconcileCustomerLedger(cust.id);
    check(`Probe 12: Ledger reconciles after creditApplied on new invoice`, rec.inSync, `drift=${rec.drift}, mismatch=${rec.runningBalanceMismatch}`);


    await cleanup({ cids: [cust.id], sids: [supp.id], pids: [prod.id] });
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  DEEP PROBE COMPLETE: ${passed} passed, ${failed} failed`);
  console.log("═══════════════════════════════════════════════════════════════");
  if (bugs.length > 0) {
    console.log("\n  BUGS FOUND:");
    for (const b of bugs) console.log(`  ✗ ${b.label}\n    ${b.detail}`);
  }

  await prisma.$disconnect();
}

main().catch(async e => { console.error("PROBE CRASHED:", e.message); await prisma.$disconnect(); });
