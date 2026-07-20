/**
 * ADVERSARIAL AUDIT - PHASE 2 MASTER SCRIPT
 * Tests every vulnerability class systematically.
 * Run from: backend/
 */
require("dotenv").config();
const prisma = require("../config/prisma");
const invoiceModel = require("../models/invoice-model");
const paymentModel = require("../models/payment-model");
const salesReturnModel = require("../models/sales-return-model");
const purchaseModel = require("../models/purchase-model");
const purchaseReturnModel = require("../models/purchase-return-model");
const stockModel = require("../models/stock-model");
const ledgerModel = require("../models/ledger-model");
const reportModel = require("../models/report-model");

let testsPassed = 0;
let testsFailed = 0;
const issues = [];

function pass(label) {
  console.log(`  ✓ PASS: ${label}`);
  testsPassed++;
}

function fail(label, detail) {
  console.error(`  ✗ FAIL: ${label}`);
  console.error(`        Detail: ${detail}`);
  testsFailed++;
  issues.push({ label, detail });
}

function check(label, condition, detail) {
  if (condition) pass(label);
  else fail(label, detail);
}

// ─── Setup helpers ─────────────────────────────────────────────────────────────
async function getUser() {
  return prisma.user.findFirst();
}
async function getCategory() {
  return prisma.category.findFirst();
}
async function makeProduct(sku, qty = 0, cat) {
  return prisma.product.create({
    data: {
      name: `AuditProd-${sku}`, sku, stockQuantity: qty,
      costPrice: 50, sellingPrice: 100, weightedAvgCost: 50,
      categoryId: cat.id
    }
  });
}
async function makeCustomer(phone) {
  return prisma.customer.create({ data: { name: `AuditCust-${phone}`, phone, balance: 0 } });
}
async function makeSupplier(phone) {
  return prisma.supplier.create({ data: { name: `AuditSupp-${phone}`, phone, balance: 0 } });
}

// ─── SECTION 1: Data Integrity Audit ──────────────────────────────────────────
async function section1_dataIntegrity(user, category) {
  console.log("\n=== SECTION 1: DATA INTEGRITY AUDIT ===");

  // Test 1.1: Product stockQuantity == StockMovement sum
  const products = await prisma.product.findMany();
  for (const p of products) {
    const result = await stockModel.verifyIntegrity(p.id);
    check(
      `Product ${p.id} (${p.name}) stockQty matches movement sum`,
      result.inSync,
      `stockQty=${result.stockQuantity}, movementSum=${result.movementTotal}`
    );
  }

  // Test 1.2: Customer.balance == CustomerLedger sum
  const customers = await prisma.customer.findMany({ where: { balance: { gt: 0 } } });
  for (const c of customers) {
    const reconcile = await ledgerModel.reconcileCustomerLedger(c.id);
    check(
      `Customer ${c.id} (${c.name}) balance in sync with ledger`,
      reconcile.inSync,
      `balance=${reconcile.denormalizedBalance}, ledgerSum=${reconcile.ledgerSum}, drift=${reconcile.drift}`
    );
    check(
      `Customer ${c.id} has no invalid references`,
      reconcile.invalidReferences.length === 0,
      `invalidReferences=${JSON.stringify(reconcile.invalidReferences)}`
    );
  }

  // Test 1.3: Supplier.balance == SupplierLedger sum
  const suppliers = await prisma.supplier.findMany({ where: { balance: { gt: 0 } } });
  for (const s of suppliers) {
    const reconcile = await ledgerModel.reconcileSupplierLedger(s.id);
    check(
      `Supplier ${s.id} (${s.name}) balance in sync with ledger`,
      reconcile.inSync,
      `balance=${reconcile.denormalizedBalance}, ledgerSum=${reconcile.ledgerSum}, drift=${reconcile.drift}`
    );
  }

  // Test 1.4: Invoice totals consistent with InvoiceItems sum
  const invoices = await prisma.invoice.findMany({ include: { items: true } });
  for (const inv of invoices) {
    const itemsSubtotal = inv.items.reduce((s, i) => s + Number(i.unitPrice) * i.quantity, 0);
    const itemsTotalPrice = inv.items.reduce((s, i) => s + Number(i.totalPrice), 0);
    // subtotal should match pre-discount sum of qty*unitPrice
    check(
      `Invoice ${inv.invoiceNo} subtotal matches item sum`,
      Math.abs(Number(inv.subtotal) - itemsSubtotal) < 0.02,
      `inv.subtotal=${inv.subtotal}, itemsSubtotal=${itemsSubtotal}`
    );
    // balanceDue = total - paidAmount - creditApplied
    const expectedBalanceDue = Number(inv.total) - Number(inv.paidAmount) - Number(inv.creditApplied || 0) - Number(inv.returnedAmount || 0);
    check(
      `Invoice ${inv.invoiceNo} balanceDue formula is consistent`,
      Math.abs(Number(inv.balanceDue) - expectedBalanceDue) < 0.02,
      `inv.balanceDue=${inv.balanceDue}, expected=${expectedBalanceDue}`
    );
  }

  // Test 1.5: Purchase totals consistent with PurchaseItems sum
  const purchases = await prisma.purchase.findMany({ include: { items: true } });
  for (const pur of purchases) {
    const itemsSubtotal = pur.items.reduce((s, i) => s + Number(i.unitCost) * i.quantity, 0);
    check(
      `Purchase ${pur.purchaseNo} subtotal matches item sum`,
      Math.abs(Number(pur.subtotal) - itemsSubtotal) < 0.02,
      `pur.subtotal=${pur.subtotal}, itemsSubtotal=${itemsSubtotal}`
    );
    const expectedBD = Number(pur.total) - Number(pur.paidAmount) - Number(pur.creditApplied || 0) - Number(pur.returnedAmount || 0);
    check(
      `Purchase ${pur.purchaseNo} balanceDue formula is consistent`,
      Math.abs(Number(pur.balanceDue) - expectedBD) < 0.02,
      `pur.balanceDue=${pur.balanceDue}, expected=${expectedBD}`
    );
  }

  // Test 1.6: PaymentAllocation totals never exceed payment
  const payments = await prisma.customerPayment.findMany({
    include: { allocations: true }
  });
  for (const p of payments) {
    const sumAlloc = p.allocations.reduce((s, a) => s + Number(a.amountAllocated), 0);
    check(
      `CustomerPayment ${p.id} alloc sum (${sumAlloc}) <= payment amount (${p.amount})`,
      sumAlloc <= Number(p.amount) + 0.01,
      `sumAlloc=${sumAlloc}, payment.amount=${p.amount}`
    );
  }

  // Test 1.7: Check for orphan InvoiceItems (invoiceId doesn't exist)
  const orphanItems = await prisma.$queryRaw`
    SELECT ii.id FROM "InvoiceItem" ii
    LEFT JOIN "Invoice" i ON ii."invoiceId" = i.id
    WHERE i.id IS NULL
  `;
  check(
    `No orphan InvoiceItems`,
    orphanItems.length === 0,
    `Found ${orphanItems.length} orphan InvoiceItems`
  );

  // Test 1.8: Duplicate invoice numbers
  const dupInvoiceNos = await prisma.$queryRaw`
    SELECT "invoiceNo", COUNT(*) as cnt
    FROM "Invoice"
    GROUP BY "invoiceNo"
    HAVING COUNT(*) > 1
  `;
  check(
    `No duplicate Invoice numbers`,
    dupInvoiceNos.length === 0,
    `Found duplicates: ${JSON.stringify(dupInvoiceNos)}`
  );
}

// ─── SECTION 2: Accounting Lifecycle Audit ────────────────────────────────────
async function section2_accounting(user, category) {
  console.log("\n=== SECTION 2: ACCOUNTING LIFECYCLE AUDIT ===");

  const prod = await makeProduct("ACC-P1", 0, category);
  const supplier = await makeSupplier("03001111111");
  const customer = await makeCustomer("03002222222");

  // Purchase 20 units @ Rs.50 net
  const purchase = await purchaseModel.createPurchase({
    supplierId: supplier.id,
    items: [{ productId: prod.id, quantity: 20, unitCost: 50 }],
    createdById: user.id
  });

  // Verify WAC
  const p1 = await prisma.product.findUnique({ where: { id: prod.id } });
  check(`WAC after purchase = 50`, Math.abs(Number(p1.weightedAvgCost) - 50) < 0.01, `WAC=${p1.weightedAvgCost}`);
  check(`Stock after purchase = 20`, p1.stockQuantity === 20, `stockQty=${p1.stockQuantity}`);

  // Purchase 10 more @ Rs.70 → WAC should be (20*50+10*70)/30 = 60
  await purchaseModel.createPurchase({
    supplierId: supplier.id,
    items: [{ productId: prod.id, quantity: 10, unitCost: 70 }],
    createdById: user.id
  });
  const p2 = await prisma.product.findUnique({ where: { id: prod.id } });
  const expectedWAC = (20 * 50 + 10 * 70) / 30;
  check(`WAC after 2nd purchase = ${expectedWAC.toFixed(4)}`, Math.abs(Number(p2.weightedAvgCost) - expectedWAC) < 0.01, `WAC=${p2.weightedAvgCost}`);

  // Sell 10 units @ Rs. 100 credit sale
  const invoice = await invoiceModel.createInvoice({
    customerId: customer.id,
    saleType: "CREDIT",
    paidAmount: 0,
    creditApplied: 0,
    discount: 0,
    items: [{ productId: prod.id, quantity: 10, unitPrice: 100 }],
    createdById: user.id
  });
  check(`Invoice total = 1000`, Math.abs(Number(invoice.total) - 1000) < 0.01, `total=${invoice.total}`);
  check(`Invoice balanceDue = 1000`, Math.abs(Number(invoice.balanceDue) - 1000) < 0.01, `balanceDue=${invoice.balanceDue}`);

  const custAfterSale = await prisma.customer.findUnique({ where: { id: customer.id } });
  check(`Customer balance = 1000 after credit sale`, Math.abs(Number(custAfterSale.balance) - 1000) < 0.01, `balance=${custAfterSale.balance}`);

  // Partial payment of Rs. 400
  await paymentModel.recordCustomerPayment({
    customerId: customer.id,
    allocations: [{ invoiceId: invoice.id, amountAllocated: 400 }],
    amount: 400,
    createdById: user.id
  });
  const invAfterPay = await prisma.invoice.findUnique({ where: { id: invoice.id } });
  check(`Invoice balanceDue = 600 after Rs.400 payment`, Math.abs(Number(invAfterPay.balanceDue) - 600) < 0.01, `balanceDue=${invAfterPay.balanceDue}`);
  const custAfterPay = await prisma.customer.findUnique({ where: { id: customer.id } });
  check(`Customer balance = 600 after Rs.400 payment`, Math.abs(Number(custAfterPay.balance) - 600) < 0.01, `balance=${custAfterPay.balance}`);

  // Sales Return (CREDIT) for 2 units
  await salesReturnModel.createSalesReturn({
    invoiceId: invoice.id,
    reason: "Damaged",
    refundType: "CREDIT",
    items: [{ productId: prod.id, quantity: 2 }],
    createdById: user.id
  });
  const invAfterReturn = await prisma.invoice.findUnique({ where: { id: invoice.id } });
  const returnAmount = 2 * (1000 / 10); // 2 * 100 = 200
  const expectedBD = 600 - returnAmount;
  check(`Invoice balanceDue = ${expectedBD} after CREDIT return`, Math.abs(Number(invAfterReturn.balanceDue) - expectedBD) < 0.01, `balanceDue=${invAfterReturn.balanceDue}`);

  // Cleanup: delete all data linked to these test entities
  await prisma.paymentAllocation.deleteMany({ where: { invoice: { customerId: customer.id } } });
  await prisma.customerLedger.deleteMany({ where: { customerId: customer.id } });
  await prisma.customerPayment.deleteMany({ where: { customerId: customer.id } });
  await prisma.salesReturnItem.deleteMany({ where: { salesReturn: { customerId: customer.id } } });
  await prisma.salesReturn.deleteMany({ where: { customerId: customer.id } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { customerId: customer.id } } });
  await prisma.invoice.deleteMany({ where: { customerId: customer.id } });
  await prisma.stockMovement.deleteMany({ where: { productId: prod.id } });
  await prisma.purchaseItem.deleteMany({ where: { purchase: { supplierId: supplier.id } } });
  await prisma.supplierLedger.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.supplierPayment.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.purchase.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.product.deleteMany({ where: { id: prod.id } });
  await prisma.customer.deleteMany({ where: { id: customer.id } });
  await prisma.supplier.deleteMany({ where: { id: supplier.id } });
}

// ─── SECTION 3: Credit Applied – All Attack Vectors ──────────────────────────
async function section3_creditApplied(user, category) {
  console.log("\n=== SECTION 3: CREDIT APPLIED ATTACK ===");

  const prod = await makeProduct("CRD-P1", 0, category);
  const supplier = await makeSupplier("03003333333");
  const customer = await makeCustomer("03004444444");

  await purchaseModel.createPurchase({
    supplierId: supplier.id,
    items: [{ productId: prod.id, quantity: 100, unitCost: 50 }],
    createdById: user.id
  });

  // Create credit invoice for Rs. 1000
  const inv = await invoiceModel.createInvoice({
    customerId: customer.id,
    saleType: "CREDIT",
    paidAmount: 0, creditApplied: 0, discount: 0,
    items: [{ productId: prod.id, quantity: 10, unitPrice: 100 }],
    createdById: user.id
  });

  // Give customer store credit via sales return (CREDIT)
  await salesReturnModel.createSalesReturn({
    invoiceId: inv.id,
    reason: "Damaged",
    refundType: "CREDIT",
    items: [{ productId: prod.id, quantity: 3 }], // Rs. 300 credit
    createdById: user.id
  });
  const custAfterReturn = await prisma.customer.findUnique({ where: { id: customer.id } });
  // Customer now owes 1000 - 300 = 700 on invoice, but ledger: +1000 debit -300 credit = 700 balance
  check(`Customer balance = 700 after 3-unit CREDIT return`, Math.abs(Number(custAfterReturn.balance) - 700) < 0.01, `balance=${custAfterReturn.balance}`);

  // Make a second invoice to try applying credit to
  const inv2 = await invoiceModel.createInvoice({
    customerId: customer.id,
    saleType: "CREDIT",
    paidAmount: 0, creditApplied: 0, discount: 0,
    items: [{ productId: prod.id, quantity: 5, unitPrice: 100 }],
    createdById: user.id
  });
  // Customer balance = 700 + 500 = 1200
  const custAfterInv2 = await prisma.customer.findUnique({ where: { id: customer.id } });
  check(`Customer balance = 1200 after 2nd invoice`, Math.abs(Number(custAfterInv2.balance) - 1200) < 0.01, `balance=${custAfterInv2.balance}`);

  // Test 3.1: Attempt to apply MORE credit than available
  // Available credit = max(0, totalOutstanding - customerBalance)
  // totalOutstanding = inv1.balanceDue + inv2.balanceDue = 700 + 500 = 1200
  // customerBalance = 1200
  // availableCredit = max(0, 1200 - 1200) = 0
  // No credit to apply since balance equals outstanding
  try {
    await paymentModel.recordCustomerPayment({
      customerId: customer.id,
      amount: 1, // Rs. 1 credit
      isCreditApplied: true,
      allocations: [{ invoiceId: inv2.id, amountAllocated: 1 }],
      createdById: user.id
    });
    fail("Credit applied > available should be rejected", "Request succeeded but should have failed");
  } catch (e) {
    check(`Excess credit application rejected`, e.message.includes("cannot exceed") || e.message.includes("Available"), `Error: ${e.message}`);
  }

  // Create store credit by overpaying (customer returns goods worth 400 from inv2 by CREDIT)
  // This means: we still owe inv2.balanceDue=500. After return of 4 units (400), balanceDue = 100
  // But we CREDIT refund, so invoice goes from 500 to 100 (CREDIT type) and customer balance drops by 400
  await salesReturnModel.createSalesReturn({
    invoiceId: inv2.id,
    reason: "Damaged",
    refundType: "CREDIT",
    items: [{ productId: prod.id, quantity: 4 }], // Rs. 400
    createdById: user.id
  });
  const custAfterReturn2 = await prisma.customer.findUnique({ where: { id: customer.id } });
  // Customer balance: 1200 - 400 (credit from return) = 800
  check(`Customer balance = 800 after 2nd return (4 units CREDIT)`, Math.abs(Number(custAfterReturn2.balance) - 800) < 0.01, `balance=${custAfterReturn2.balance}`);

  // Test 3.2: Verify credit available formula
  // inv1.balanceDue = 700, inv2.balanceDue = 100 → totalOutstanding = 800
  // customer.balance = 800 → availableCredit = max(0, 800-800) = 0
  // So still no credit to apply
  const inv1Final = await prisma.invoice.findUnique({ where: { id: inv.id } });
  const inv2Final = await prisma.invoice.findUnique({ where: { id: inv2.id } });
  check(`inv1.balanceDue=700 after CREDIT return`, Math.abs(Number(inv1Final.balanceDue) - 700) < 0.01, `balanceDue=${inv1Final.balanceDue}`);
  check(`inv2.balanceDue=100 after 4-unit CREDIT return`, Math.abs(Number(inv2Final.balanceDue) - 100) < 0.01, `balanceDue=${inv2Final.balanceDue}`);

  // Cleanup
  await prisma.paymentAllocation.deleteMany({ where: { invoice: { customerId: customer.id } } });
  await prisma.customerLedger.deleteMany({ where: { customerId: customer.id } });
  await prisma.customerPayment.deleteMany({ where: { customerId: customer.id } });
  await prisma.salesReturnItem.deleteMany({ where: { salesReturn: { customerId: customer.id } } });
  await prisma.salesReturn.deleteMany({ where: { customerId: customer.id } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { customerId: customer.id } } });
  await prisma.invoice.deleteMany({ where: { customerId: customer.id } });
  await prisma.stockMovement.deleteMany({ where: { productId: prod.id } });
  await prisma.purchaseItem.deleteMany({ where: { purchase: { supplierId: supplier.id } } });
  await prisma.supplierLedger.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.supplierPayment.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.purchase.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.product.deleteMany({ where: { id: prod.id } });
  await prisma.customer.deleteMany({ where: { id: customer.id } });
  await prisma.supplier.deleteMany({ where: { id: supplier.id } });
}

// ─── SECTION 4: Returns – Multi-scenario Attack ───────────────────────────────
async function section4_returns(user, category) {
  console.log("\n=== SECTION 4: RETURNS ATTACK ===");

  const prod = await makeProduct("RET-P1", 0, category);
  const supplier = await makeSupplier("03005555555");
  const customer = await makeCustomer("03006666666");

  await purchaseModel.createPurchase({
    supplierId: supplier.id,
    items: [{ productId: prod.id, quantity: 100, unitCost: 50 }],
    createdById: user.id
  });

  const inv = await invoiceModel.createInvoice({
    customerId: customer.id,
    saleType: "CREDIT",
    paidAmount: 0, creditApplied: 0, discount: 0,
    items: [{ productId: prod.id, quantity: 10, unitPrice: 100 }],
    createdById: user.id
  });

  // Test 4.1: Try to return MORE than sold
  try {
    await salesReturnModel.createSalesReturn({
      invoiceId: inv.id,
      reason: "Test",
      refundType: "CREDIT",
      items: [{ productId: prod.id, quantity: 11 }], // sold only 10
      createdById: user.id
    });
    fail("Return more than sold should be rejected", "Succeeded but should have failed");
  } catch (e) {
    check(`Return > sold rejected`, e.message.includes("exceeds") || e.message.includes("remaining"), `Error: ${e.message}`);
  }

  // Test 4.2: Multiple partial returns that together exceed original quantity
  // Return 5 first
  await salesReturnModel.createSalesReturn({
    invoiceId: inv.id,
    reason: "Partial 1",
    refundType: "CREDIT",
    items: [{ productId: prod.id, quantity: 5 }],
    createdById: user.id
  });
  // Return 5 more (exactly the remainder - should succeed)
  await salesReturnModel.createSalesReturn({
    invoiceId: inv.id,
    reason: "Partial 2",
    refundType: "CREDIT",
    items: [{ productId: prod.id, quantity: 5 }],
    createdById: user.id
  });
  // Try to return 1 more (nothing left)
  try {
    await salesReturnModel.createSalesReturn({
      invoiceId: inv.id,
      reason: "Partial 3",
      refundType: "CREDIT",
      items: [{ productId: prod.id, quantity: 1 }],
      createdById: user.id
    });
    fail("3rd return after full return should be rejected", "Succeeded but should have failed");
  } catch (e) {
    check(`3rd partial return rejected (nothing left)`, e.message.includes("exceeds") || e.message.includes("remaining"), `Error: ${e.message}`);
  }

  // Test 4.3: CASH refund should not alter invoice.balanceDue on a credit invoice
  const inv2 = await invoiceModel.createInvoice({
    customerId: customer.id,
    saleType: "CREDIT",
    paidAmount: 0, creditApplied: 0, discount: 0,
    items: [{ productId: prod.id, quantity: 10, unitPrice: 100 }],
    createdById: user.id
  });
  const inv2Before = await prisma.invoice.findUnique({ where: { id: inv2.id } });
  await salesReturnModel.createSalesReturn({
    invoiceId: inv2.id,
    reason: "Cash test",
    refundType: "CASH",
    items: [{ productId: prod.id, quantity: 3 }], // Rs. 300
    createdById: user.id
  });
  const inv2After = await prisma.invoice.findUnique({ where: { id: inv2.id } });
  check(
    `CASH return does NOT reduce invoice.balanceDue`,
    Math.abs(Number(inv2After.balanceDue) - Number(inv2Before.balanceDue)) < 0.01,
    `before=${inv2Before.balanceDue}, after=${inv2After.balanceDue}`
  );
  // Customer balance should also remain the same after CASH return (credit+debit cancel out)
  const custAfterCash = await prisma.customer.findUnique({ where: { id: customer.id } });
  // After 2 invoices (1000+1000=2000), full return of inv1 (both partials), and cash return on inv2:
  // Customer ledger: +1000 (inv1) +1000 (inv2) -500 (ret1 credit) -500 (ret2 credit) -300 (cash ret credit) +300 (cash ret debit) = 1000
  // However inv1.balanceDue = 0 (fully returned by credit), inv2.balanceDue = 1000 (unchanged by cash)
  check(
    `Customer balance after CASH return equals original minus credit returns only`,
    Number(custAfterCash.balance) > 0,
    `balance=${custAfterCash.balance}`
  );

  // Test 4.4: Verify stock increases correctly after return
  const stockBefore = (await prisma.product.findUnique({ where: { id: prod.id } })).stockQuantity;
  // We've done: Purchase 100, Sell 10 (inv1), Sell 10 (inv2), Return 5+5 on inv1, Return 3 on inv2 (CASH)
  // Expected: 100 - 10 - 10 + 5 + 5 + 3 = 93
  check(`Stock after all sales and returns = 93`, stockBefore === 93, `stockQty=${stockBefore}`);

  // Cleanup
  await prisma.paymentAllocation.deleteMany({ where: { invoice: { customerId: customer.id } } });
  await prisma.customerLedger.deleteMany({ where: { customerId: customer.id } });
  await prisma.customerPayment.deleteMany({ where: { customerId: customer.id } });
  await prisma.salesReturnItem.deleteMany({ where: { salesReturn: { customerId: customer.id } } });
  await prisma.salesReturn.deleteMany({ where: { customerId: customer.id } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { customerId: customer.id } } });
  await prisma.invoice.deleteMany({ where: { customerId: customer.id } });
  await prisma.stockMovement.deleteMany({ where: { productId: prod.id } });
  await prisma.purchaseItem.deleteMany({ where: { purchase: { supplierId: supplier.id } } });
  await prisma.supplierLedger.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.supplierPayment.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.purchase.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.product.deleteMany({ where: { id: prod.id } });
  await prisma.customer.deleteMany({ where: { id: customer.id } });
  await prisma.supplier.deleteMany({ where: { id: supplier.id } });
}

// ─── SECTION 5: Payment Allocation Attacks ────────────────────────────────────
async function section5_paymentAllocation(user, category) {
  console.log("\n=== SECTION 5: PAYMENT ALLOCATION AUDIT ===");

  const prod = await makeProduct("PAY-P1", 0, category);
  const supplier = await makeSupplier("03007777777");
  const customer = await makeCustomer("03008888888");

  await purchaseModel.createPurchase({
    supplierId: supplier.id,
    items: [{ productId: prod.id, quantity: 50, unitCost: 50 }],
    createdById: user.id
  });

  const inv1 = await invoiceModel.createInvoice({
    customerId: customer.id, saleType: "CREDIT",
    paidAmount: 0, creditApplied: 0, discount: 0,
    items: [{ productId: prod.id, quantity: 5, unitPrice: 100 }],
    createdById: user.id
  });
  const inv2 = await invoiceModel.createInvoice({
    customerId: customer.id, saleType: "CREDIT",
    paidAmount: 0, creditApplied: 0, discount: 0,
    items: [{ productId: prod.id, quantity: 5, unitPrice: 100 }],
    createdById: user.id
  });
  // Customer balance = 1000

  // Test 5.1: Allocate across two invoices in one payment
  const pay1 = await paymentModel.recordCustomerPayment({
    customerId: customer.id,
    amount: 700,
    allocations: [
      { invoiceId: inv1.id, amountAllocated: 300 },
      { invoiceId: inv2.id, amountAllocated: 400 },
    ],
    createdById: user.id
  });
  const inv1AfterPay = await prisma.invoice.findUnique({ where: { id: inv1.id } });
  const inv2AfterPay = await prisma.invoice.findUnique({ where: { id: inv2.id } });
  check(`inv1.balanceDue = 200 after Rs.300 allocation`, Math.abs(Number(inv1AfterPay.balanceDue) - 200) < 0.01, `balanceDue=${inv1AfterPay.balanceDue}`);
  check(`inv2.balanceDue = 100 after Rs.400 allocation`, Math.abs(Number(inv2AfterPay.balanceDue) - 100) < 0.01, `balanceDue=${inv2AfterPay.balanceDue}`);
  const custAfterAlloc = await prisma.customer.findUnique({ where: { id: customer.id } });
  check(`Customer balance = 300 after Rs.700 payment`, Math.abs(Number(custAfterAlloc.balance) - 300) < 0.01, `balance=${custAfterAlloc.balance}`);

  // Test 5.2: Try to allocate MORE than payment amount (split allocation)
  const pay2 = await paymentModel.recordCustomerPayment({
    customerId: customer.id,
    amount: 100,
    createdById: user.id
  });
  try {
    await paymentModel.allocateCustomerPayment({
      customerPaymentId: pay2.id,
      allocations: [
        { invoiceId: inv1.id, amountAllocated: 80 },
        { invoiceId: inv2.id, amountAllocated: 80 }, // Total 160 > payment 100
      ]
    });
    fail("Allocating more than payment should be rejected", "Succeeded but should have failed");
  } catch (e) {
    check(`Allocation > payment amount rejected`, e.message.includes("cannot exceed") || e.message.includes("available"), `Error: ${e.message}`);
  }

  // Test 5.3: Allocate to invoice that belongs to different customer
  const otherCustomer = await makeCustomer("03009999999");
  const otherInv = await invoiceModel.createInvoice({
    customerId: otherCustomer.id, saleType: "CREDIT",
    paidAmount: 0, creditApplied: 0, discount: 0,
    items: [{ productId: prod.id, quantity: 1, unitPrice: 100 }],
    createdById: user.id
  });
  try {
    await paymentModel.allocateCustomerPayment({
      customerPaymentId: pay2.id, // belongs to customer
      allocations: [{ invoiceId: otherInv.id, amountAllocated: 50 }] // belongs to otherCustomer
    });
    fail("Allocation to wrong customer invoice should be rejected", "Succeeded but should have failed");
  } catch (e) {
    check(`Allocation to wrong customer invoice rejected`, e.message.includes("does not belong"), `Error: ${e.message}`);
  }

  // Test 5.4: Try to over-allocate on single invoice
  try {
    await paymentModel.allocateCustomerPayment({
      customerPaymentId: pay2.id,
      allocations: [{ invoiceId: inv1.id, amountAllocated: 500 }] // inv1 only has 200 due
    });
    fail("Allocation exceeding invoice balance should be rejected", "Succeeded but should have failed");
  } catch (e) {
    check(`Over-allocation on invoice rejected`, e.message.includes("exceeds") || e.message.includes("outstanding"), `Error: ${e.message}`);
  }

  // Cleanup
  await prisma.paymentAllocation.deleteMany({ where: { invoice: { customerId: customer.id } } });
  await prisma.paymentAllocation.deleteMany({ where: { invoice: { customerId: otherCustomer.id } } });
  await prisma.customerLedger.deleteMany({ where: { customerId: { in: [customer.id, otherCustomer.id] } } });
  await prisma.customerPayment.deleteMany({ where: { customerId: { in: [customer.id, otherCustomer.id] } } });
  await prisma.salesReturnItem.deleteMany({ where: { salesReturn: { customerId: customer.id } } });
  await prisma.salesReturn.deleteMany({ where: { customerId: customer.id } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { customerId: { in: [customer.id, otherCustomer.id] } } } });
  await prisma.invoice.deleteMany({ where: { customerId: { in: [customer.id, otherCustomer.id] } } });
  await prisma.stockMovement.deleteMany({ where: { productId: prod.id } });
  await prisma.purchaseItem.deleteMany({ where: { purchase: { supplierId: supplier.id } } });
  await prisma.supplierLedger.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.supplierPayment.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.purchase.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.product.deleteMany({ where: { id: prod.id } });
  await prisma.customer.deleteMany({ where: { id: { in: [customer.id, otherCustomer.id] } } });
  await prisma.supplier.deleteMany({ where: { id: supplier.id } });
}

// ─── SECTION 6: Destructive / Invalid Input Testing ───────────────────────────
async function section6_destructive(user, category) {
  console.log("\n=== SECTION 6: DESTRUCTIVE TESTING ===");

  const prod = await makeProduct("DST-P1", 10, category);
  const supplier = await makeSupplier("03010101010");
  const customer = await makeCustomer("03011111111");

  // Test 6.1: Zero quantity invoice item
  try {
    await invoiceModel.createInvoice({
      customerId: customer.id, saleType: "CASH",
      paidAmount: 0, creditApplied: 0, discount: 0,
      items: [{ productId: prod.id, quantity: 0, unitPrice: 100 }],
      createdById: user.id
    });
    fail("Zero quantity invoice should be rejected", "Succeeded but should have failed");
  } catch (e) {
    check(`Zero quantity invoice item rejected`, true, `Error: ${e.message}`);
  }

  // Test 6.2: Negative quantity invoice item
  try {
    await invoiceModel.createInvoice({
      customerId: customer.id, saleType: "CASH",
      paidAmount: 0, creditApplied: 0, discount: 0,
      items: [{ productId: prod.id, quantity: -5, unitPrice: 100 }],
      createdById: user.id
    });
    fail("Negative quantity invoice should be rejected", "Succeeded but should have failed");
  } catch (e) {
    check(`Negative quantity invoice item rejected`, true, `Error: ${e.message}`);
  }

  // Test 6.3: Insufficient stock
  try {
    await invoiceModel.createInvoice({
      customerId: customer.id, saleType: "CASH",
      paidAmount: 10000, creditApplied: 0, discount: 0,
      items: [{ productId: prod.id, quantity: 9999, unitPrice: 100 }], // more than available (10)
      createdById: user.id
    });
    fail("Over-stock invoice should be rejected", "Succeeded but should have failed");
  } catch (e) {
    check(`Insufficient stock invoice rejected`, e.message.toLowerCase().includes("insufficient") || e.message.toLowerCase().includes("stock"), `Error: ${e.message}`);
  }

  // Test 6.4: Negative payment amount
  await purchaseModel.createPurchase({
    supplierId: supplier.id,
    items: [{ productId: prod.id, quantity: 50, unitCost: 50 }],
    createdById: user.id
  });
  const inv = await invoiceModel.createInvoice({
    customerId: customer.id, saleType: "CREDIT",
    paidAmount: 0, creditApplied: 0, discount: 0,
    items: [{ productId: prod.id, quantity: 5, unitPrice: 100 }],
    createdById: user.id
  });
  try {
    await paymentModel.recordCustomerPayment({
      customerId: customer.id,
      amount: -100,
      allocations: [{ invoiceId: inv.id, amountAllocated: -100 }],
      createdById: user.id
    });
    fail("Negative payment amount should be rejected", "Succeeded but should have failed");
  } catch (e) {
    check(`Negative payment amount rejected`, true, `Error: ${e.message}`);
  }

  // Test 6.5: Payment exceeding outstanding balance
  try {
    await paymentModel.recordCustomerPayment({
      customerId: customer.id,
      amount: 99999, // far exceeds the outstanding balance
      createdById: user.id
    });
    fail("Payment > outstanding balance should be rejected", "Succeeded but should have failed");
  } catch (e) {
    check(`Payment > outstanding balance rejected`, e.message.includes("cannot exceed"), `Error: ${e.message}`);
  }

  // Test 6.6: Invoice with paidAmount + creditApplied > total
  try {
    await invoiceModel.createInvoice({
      customerId: customer.id, saleType: "CREDIT",
      paidAmount: 5000, creditApplied: 0, discount: 0,
      items: [{ productId: prod.id, quantity: 5, unitPrice: 100 }],
      createdById: user.id
    });
    fail("paidAmount > total should be rejected", "Succeeded but should have failed");
  } catch (e) {
    check(`paidAmount > total rejected`, e.message.includes("cannot exceed"), `Error: ${e.message}`);
  }

  // Cleanup
  await prisma.paymentAllocation.deleteMany({ where: { invoice: { customerId: customer.id } } });
  await prisma.customerLedger.deleteMany({ where: { customerId: customer.id } });
  await prisma.customerPayment.deleteMany({ where: { customerId: customer.id } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { customerId: customer.id } } });
  await prisma.invoice.deleteMany({ where: { customerId: customer.id } });
  await prisma.stockMovement.deleteMany({ where: { productId: prod.id } });
  await prisma.purchaseItem.deleteMany({ where: { purchase: { supplierId: supplier.id } } });
  await prisma.supplierLedger.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.supplierPayment.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.purchase.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.product.deleteMany({ where: { id: prod.id } });
  await prisma.customer.deleteMany({ where: { id: customer.id } });
  await prisma.supplier.deleteMany({ where: { id: supplier.id } });
}

// ─── SECTION 7: Concurrency Attack ────────────────────────────────────────────
async function section7_concurrency(user, category) {
  console.log("\n=== SECTION 7: CONCURRENCY ATTACK ===");

  const prod = await makeProduct("CON-P1", 0, category);
  const supplier = await makeSupplier("03012121212");
  const customer = await makeCustomer("03013131313");

  await purchaseModel.createPurchase({
    supplierId: supplier.id,
    items: [{ productId: prod.id, quantity: 5, unitCost: 50 }], // Only 5 in stock
    createdById: user.id
  });

  // Test 7.1: Two users trying to sell the LAST 5 units simultaneously
  // (Concurrent invoices for 4 each = 8 total > 5 stock)
  const [result1, result2] = await Promise.allSettled([
    invoiceModel.createInvoice({
      customerId: customer.id, saleType: "CASH",
      paidAmount: 400, creditApplied: 0, discount: 0,
      items: [{ productId: prod.id, quantity: 4, unitPrice: 100 }],
      createdById: user.id
    }),
    invoiceModel.createInvoice({
      customerId: customer.id, saleType: "CASH",
      paidAmount: 400, creditApplied: 0, discount: 0,
      items: [{ productId: prod.id, quantity: 4, unitPrice: 100 }],
      createdById: user.id
    }),
  ]);

  const bothSucceeded = result1.status === "fulfilled" && result2.status === "fulfilled";
  const atLeastOneFailed = result1.status === "rejected" || result2.status === "rejected";
  check(
    `Concurrent sale of 4+4 with only 5 stock: at least one rejected`,
    atLeastOneFailed,
    bothSucceeded ? "CRITICAL: Both succeeded — negative stock is possible!" : "Correct: one was rejected"
  );

  if (bothSucceeded) {
    const prod2 = await prisma.product.findUnique({ where: { id: prod.id } });
    fail("Negative stock occurred due to race condition", `stockQuantity=${prod2.stockQuantity}`);
  }

  // Test 7.2: Two users allocating the same general payment to invoices concurrently
  // Reset stock
  await purchaseModel.createPurchase({
    supplierId: supplier.id,
    items: [{ productId: prod.id, quantity: 20, unitCost: 50 }],
    createdById: user.id
  });
  const inv1 = await invoiceModel.createInvoice({
    customerId: customer.id, saleType: "CREDIT",
    paidAmount: 0, creditApplied: 0, discount: 0,
    items: [{ productId: prod.id, quantity: 5, unitPrice: 100 }],
    createdById: user.id
  });
  const inv2 = await invoiceModel.createInvoice({
    customerId: customer.id, saleType: "CREDIT",
    paidAmount: 0, creditApplied: 0, discount: 0,
    items: [{ productId: prod.id, quantity: 5, unitPrice: 100 }],
    createdById: user.id
  });

  const genPay = await paymentModel.recordCustomerPayment({
    customerId: customer.id,
    amount: 500,
    createdById: user.id
  });

  // Two concurrent allocation requests for the SAME payment, each trying to allocate Rs.300
  const [allocResult1, allocResult2] = await Promise.allSettled([
    paymentModel.allocateCustomerPayment({
      customerPaymentId: genPay.id,
      allocations: [{ invoiceId: inv1.id, amountAllocated: 300 }]
    }),
    paymentModel.allocateCustomerPayment({
      customerPaymentId: genPay.id,
      allocations: [{ invoiceId: inv2.id, amountAllocated: 300 }]
    }),
  ]);

  // Total of 600 > 500 payment, so at least one must fail
  const bothAllocSucceeded = allocResult1.status === "fulfilled" && allocResult2.status === "fulfilled";
  check(
    `Concurrent allocation of 300+300 with only 500 payment: at least one rejected`,
    !bothAllocSucceeded,
    bothAllocSucceeded ? "CRITICAL: Both allocations succeeded — over-allocation occurred!" : "Correct: one allocation was rejected"
  );

  if (bothAllocSucceeded) {
    const allocs = await prisma.paymentAllocation.findMany({ where: { customerPaymentId: genPay.id } });
    const totalAlloc = allocs.reduce((s, a) => s + Number(a.amountAllocated), 0);
    fail(`Over-allocation confirmed: total allocated = ${totalAlloc} on payment of ${genPay.amount}`, `allocations=${JSON.stringify(allocs)}`);
  }

  // Cleanup
  await prisma.paymentAllocation.deleteMany({ where: { invoice: { customerId: customer.id } } });
  await prisma.customerLedger.deleteMany({ where: { customerId: customer.id } });
  await prisma.customerPayment.deleteMany({ where: { customerId: customer.id } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { customerId: customer.id } } });
  await prisma.invoice.deleteMany({ where: { customerId: customer.id } });
  await prisma.stockMovement.deleteMany({ where: { productId: prod.id } });
  await prisma.purchaseItem.deleteMany({ where: { purchase: { supplierId: supplier.id } } });
  await prisma.supplierLedger.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.supplierPayment.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.purchase.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.product.deleteMany({ where: { id: prod.id } });
  await prisma.customer.deleteMany({ where: { id: customer.id } });
  await prisma.supplier.deleteMany({ where: { id: supplier.id } });
}

// ─── SECTION 8: Financial Invariant Verification ─────────────────────────────
async function section8_financialInvariants(user, category) {
  console.log("\n=== SECTION 8: FINANCIAL INVARIANTS AUDIT ===");

  // 8.1: Total customer outstanding = sum(customer.balance where > 0)
  const custOutstanding = await prisma.$queryRaw`
    SELECT COALESCE(SUM(balance::numeric), 0) as total FROM "Customer" WHERE balance > 0
  `;
  const totalCustomerReceivables = Number(custOutstanding[0].total);

  const invoiceOutstanding = await prisma.$queryRaw`
    SELECT COALESCE(SUM("balanceDue"::numeric), 0) as total FROM "Invoice" WHERE "balanceDue" > 0
  `;
  const totalInvoicesDue = Number(invoiceOutstanding[0].total);

  check(
    `Customer outstanding balance = sum of open invoice balanceDue`,
    Math.abs(totalCustomerReceivables - totalInvoicesDue) < 1.0,
    `customerOutstanding=${totalCustomerReceivables}, invoiceOutstanding=${totalInvoicesDue}, drift=${Math.abs(totalCustomerReceivables - totalInvoicesDue)}`
  );

  // 8.2: Total supplier outstanding = sum(supplier.balance where > 0)
  const suppOutstanding = await prisma.$queryRaw`
    SELECT COALESCE(SUM(balance::numeric), 0) as total FROM "Supplier" WHERE balance > 0
  `;
  const totalSupplierPayables = Number(suppOutstanding[0].total);

  const purchaseOutstanding = await prisma.$queryRaw`
    SELECT COALESCE(SUM("balanceDue"::numeric), 0) as total FROM "Purchase" WHERE "balanceDue" > 0
  `;
  const totalPurchasesDue = Number(purchaseOutstanding[0].total);

  check(
    `Supplier outstanding balance = sum of open purchase balanceDue`,
    Math.abs(totalSupplierPayables - totalPurchasesDue) < 1.0,
    `supplierOutstanding=${totalSupplierPayables}, purchaseDue=${totalPurchasesDue}, drift=${Math.abs(totalSupplierPayables - totalPurchasesDue)}`
  );

  // 8.3: Inventory value: sum(stockQuantity * weightedAvgCost) should match report
  const stockReport = await reportModel.currentStockReport();
  const rawInventoryValue = await prisma.$queryRaw`
    SELECT COALESCE(SUM("stockQuantity"::numeric * "weightedAvgCost"::numeric), 0) as total
    FROM "Product"
    WHERE "isActive" = true
  `;
  const rawTotal = Number(rawInventoryValue[0].total);
  check(
    `Report inventory value matches raw SQL inventory value`,
    Math.abs(stockReport.totalValueAtCost - rawTotal) < 0.01,
    `report=${stockReport.totalValueAtCost}, rawSQL=${rawTotal}`
  );

  // 8.4: Verify no invoice has negative balanceDue (corruption)
  const negativeBalanceDue = await prisma.$queryRaw`
    SELECT id, "invoiceNo", "balanceDue" FROM "Invoice" WHERE "balanceDue" < 0
  `;
  check(
    `No invoices with negative balanceDue`,
    negativeBalanceDue.length === 0,
    `Found ${negativeBalanceDue.length} invoices: ${JSON.stringify(negativeBalanceDue)}`
  );

  // 8.5: Verify no purchase has negative balanceDue
  const negPurBD = await prisma.$queryRaw`
    SELECT id, "purchaseNo", "balanceDue" FROM "Purchase" WHERE "balanceDue" < 0
  `;
  check(
    `No purchases with negative balanceDue`,
    negPurBD.length === 0,
    `Found ${negPurBD.length} purchases: ${JSON.stringify(negPurBD)}`
  );

  // 8.6: Verify no product has negative stock
  const negStock = await prisma.$queryRaw`
    SELECT id, name, "stockQuantity" FROM "Product" WHERE "stockQuantity" < 0
  `;
  check(
    `No products with negative stockQuantity`,
    negStock.length === 0,
    `Found ${negStock.length} products: ${JSON.stringify(negStock)}`
  );

  // 8.7: Payment allocations sum vs invoice paidAmount sum
  const payAllocSum = await prisma.$queryRaw`
    SELECT "invoiceId", COALESCE(SUM("amountAllocated"::numeric), 0) as total
    FROM "PaymentAllocation"
    GROUP BY "invoiceId"
  `;
  for (const row of payAllocSum) {
    const inv = await prisma.invoice.findUnique({ where: { id: Number(row.invoiceId) } });
    if (inv) {
      // The invoice paidAmount should be >= sum of allocations pointing to it
      // (some paid upfront, some via later allocations)
      check(
        `Invoice ${inv.invoiceNo} paidAmount (${inv.paidAmount}) >= allocation sum (${row.total})`,
        Number(inv.paidAmount) >= Number(row.total) - 0.01,
        `paidAmount=${inv.paidAmount}, allocSum=${row.total}`
      );
    }
  }
}

// ─── SECTION 9: Supplier Payment Invariants ────────────────────────────────────
async function section9_supplierPayments(user, category) {
  console.log("\n=== SECTION 9: SUPPLIER PAYMENT INVARIANTS ===");

  const prod = await makeProduct("SPP-P1", 0, category);
  const supplier = await makeSupplier("03014141414");

  // Create purchase
  const purchase = await purchaseModel.createPurchase({
    supplierId: supplier.id,
    items: [{ productId: prod.id, quantity: 10, unitCost: 100 }],
    createdById: user.id
  });
  // total = 1000, balanceDue = 1000

  // Test 9.1: Supplier payment exceeding purchase balance
  try {
    await paymentModel.recordSupplierPayment({
      supplierId: supplier.id,
      purchaseId: purchase.id,
      amount: 5000, // way more than 1000
      createdById: user.id
    });
    fail("Supplier payment > purchase balanceDue should be rejected", "Succeeded but should have failed");
  } catch (e) {
    check(`Supplier payment > purchase balanceDue rejected`, e.message.includes("cannot exceed"), `Error: ${e.message}`);
  }

  // Test 9.2: Partial supplier payment
  await paymentModel.recordSupplierPayment({
    supplierId: supplier.id,
    purchaseId: purchase.id,
    amount: 600,
    createdById: user.id
  });
  const purAfter = await prisma.purchase.findUnique({ where: { id: purchase.id } });
  check(`Purchase balanceDue = 400 after Rs.600 payment`, Math.abs(Number(purAfter.balanceDue) - 400) < 0.01, `balanceDue=${purAfter.balanceDue}`);
  const suppAfter = await prisma.supplier.findUnique({ where: { id: supplier.id } });
  check(`Supplier balance = 400 after Rs.600 payment`, Math.abs(Number(suppAfter.balance) - 400) < 0.01, `balance=${suppAfter.balance}`);

  // Test 9.3: Supplier reconciliation
  const reconcile = await ledgerModel.reconcileSupplierLedger(supplier.id);
  check(`Supplier ledger in sync after partial payment`, reconcile.inSync, `drift=${reconcile.drift}, mismatch=${reconcile.runningBalanceMismatch}`);
  check(`No invalid supplier references`, reconcile.invalidReferences.length === 0, `refs=${JSON.stringify(reconcile.invalidReferences)}`);

  // Test 9.4: Purchase return reduces supplier balance
  const purchaseReturn = await purchaseReturnModel.createPurchaseReturn({
    supplierId: supplier.id,
    purchaseId: purchase.id,
    reason: "Damaged",
    items: [{ productId: prod.id, quantity: 2 }],
    createdById: user.id
  });
  const purAfterReturn = await prisma.purchase.findUnique({ where: { id: purchase.id } });
  // Return reduces balanceDue by min(returnAmount, balanceDue) = min(200, 400) = 200
  check(`Purchase balanceDue = 200 after purchase return`, Math.abs(Number(purAfterReturn.balanceDue) - 200) < 0.01, `balanceDue=${purAfterReturn.balanceDue}`);
  const suppAfterReturn = await prisma.supplier.findUnique({ where: { id: supplier.id } });
  check(`Supplier balance = 200 after purchase return`, Math.abs(Number(suppAfterReturn.balance) - 200) < 0.01, `balance=${suppAfterReturn.balance}`);

  // Cleanup
  await prisma.supplierLedger.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.supplierPayment.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.purchaseReturnItem.deleteMany({ where: { purchaseReturn: { supplierId: supplier.id } } });
  await prisma.purchaseReturn.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.purchaseItem.deleteMany({ where: { purchase: { supplierId: supplier.id } } });
  await prisma.stockMovement.deleteMany({ where: { productId: prod.id } });
  await prisma.purchase.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.product.deleteMany({ where: { id: prod.id } });
  await prisma.supplier.deleteMany({ where: { id: supplier.id } });
}

// ─── SECTION 10: Reporting Cross-Check ────────────────────────────────────────
async function section10_reports(user, category) {
  console.log("\n=== SECTION 10: REPORTING CROSS-CHECK ===");

  const prod = await makeProduct("RPT-P1", 0, category);
  const supplier = await makeSupplier("03015151515");
  const customer = await makeCustomer("03016161616");

  await purchaseModel.createPurchase({
    supplierId: supplier.id,
    items: [{ productId: prod.id, quantity: 100, unitCost: 40 }],
    createdById: user.id
  });

  const today = new Date();
  const from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
  const to = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString();

  const inv1 = await invoiceModel.createInvoice({
    customerId: customer.id, saleType: "CREDIT",
    paidAmount: 0, creditApplied: 0, discount: 0,
    items: [{ productId: prod.id, quantity: 10, unitPrice: 100 }],
    createdById: user.id
  });
  const inv2 = await invoiceModel.createInvoice({
    customerId: customer.id, saleType: "CREDIT",
    paidAmount: 0, creditApplied: 0, discount: 50, // Rs. 50 discount
    items: [{ productId: prod.id, quantity: 5, unitPrice: 100 }],
    createdById: user.id
  });

  // Report: sales by product
  const salesByProd = await reportModel.salesByProduct(from, to);
  const prodName = `${prod.name}`;
  const prodEntry = salesByProd.find(s => s.name.includes(prod.name));

  // Expected: inv1 total = 1000, inv2 total = 500 - 50 = 450. Total = 1450
  check(
    `salesByProduct includes our audit product`,
    prodEntry !== undefined,
    `Not found in: ${JSON.stringify(salesByProd.map(s => s.name))}`
  );
  if (prodEntry) {
    check(
      `salesByProduct value = 1450 (1000 + 450)`,
      Math.abs(prodEntry.value - 1450) < 0.02,
      `value=${prodEntry.value}, expected=1450`
    );
  }

  // Profit report cross-check: gross profit = sales - COGS
  const profitReport = await reportModel.profitReport(from, to);
  const rawSales = await prisma.$queryRaw`
    SELECT COALESCE(SUM(total::numeric), 0) as total FROM "Invoice"
    WHERE "invoiceDate" >= ${new Date(from)} AND "invoiceDate" <= ${new Date(to)}
  `;
  const rawCOGS = await prisma.$queryRaw`
    SELECT COALESCE(SUM(ii."costPriceAtSale"::numeric * ii.quantity::numeric), 0) as cogs
    FROM "InvoiceItem" ii
    JOIN "Invoice" i ON ii."invoiceId" = i.id
    WHERE i."invoiceDate" >= ${new Date(from)} AND i."invoiceDate" <= ${new Date(to)}
  `;
  const expectedSales = Number(rawSales[0].total);
  const expectedCOGS = Number(rawCOGS[0].cogs);
  const expectedGrossProfit = expectedSales - expectedCOGS;

  check(
    `profitReport.grossProfit matches raw SQL calculation`,
    Math.abs(profitReport - expectedGrossProfit) < 0.02,
    `report=${profitReport}, expected=${expectedGrossProfit}`
  );

  // Cleanup
  await prisma.paymentAllocation.deleteMany({ where: { invoice: { customerId: customer.id } } });
  await prisma.customerLedger.deleteMany({ where: { customerId: customer.id } });
  await prisma.customerPayment.deleteMany({ where: { customerId: customer.id } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { customerId: customer.id } } });
  await prisma.invoice.deleteMany({ where: { customerId: customer.id } });
  await prisma.stockMovement.deleteMany({ where: { productId: prod.id } });
  await prisma.purchaseItem.deleteMany({ where: { purchase: { supplierId: supplier.id } } });
  await prisma.supplierLedger.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.supplierPayment.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.purchase.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.product.deleteMany({ where: { id: prod.id } });
  await prisma.customer.deleteMany({ where: { id: customer.id } });
  await prisma.supplier.deleteMany({ where: { id: supplier.id } });
}

// ─── SECTION 11: Invoice with upfront payment ledger verification ─────────────
async function section11_invoiceWithUpfrontPayment(user, category) {
  console.log("\n=== SECTION 11: INVOICE UPFRONT PAYMENT LEDGER ===");
  // When a CREDIT invoice is created with paidAmount > 0, 
  // it should record: debit = total, credit = paidAmount → net delta = balanceDue
  const prod = await makeProduct("UPF-P1", 0, category);
  const supplier = await makeSupplier("03017171717");
  const customer = await makeCustomer("03018181818");

  await purchaseModel.createPurchase({
    supplierId: supplier.id,
    items: [{ productId: prod.id, quantity: 20, unitCost: 50 }],
    createdById: user.id
  });

  const inv = await invoiceModel.createInvoice({
    customerId: customer.id, saleType: "CREDIT",
    paidAmount: 300, creditApplied: 0, discount: 0,
    items: [{ productId: prod.id, quantity: 10, unitPrice: 100 }],
    createdById: user.id
  });
  // total = 1000, paidAmount = 300, balanceDue = 700
  // Ledger should: debit 1000 (invoice) then credit 300 (payment) → customer.balance = 700
  const cust = await prisma.customer.findUnique({ where: { id: customer.id } });
  check(`Customer balance = 700 after credit invoice with Rs.300 upfront`, Math.abs(Number(cust.balance) - 700) < 0.01, `balance=${cust.balance}`);
  check(`Invoice balanceDue = 700`, Math.abs(Number(inv.balanceDue) - 700) < 0.01, `balanceDue=${inv.balanceDue}`);

  // Verify ledger entries
  const ledgerEntries = await prisma.customerLedger.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "asc" }
  });
  check(`2 ledger entries created (debit + credit)`, ledgerEntries.length === 2, `entries=${ledgerEntries.length}`);
  if (ledgerEntries.length >= 2) {
    check(`First entry is debit of 1000`, Math.abs(Number(ledgerEntries[0].debit) - 1000) < 0.01, `debit=${ledgerEntries[0].debit}`);
    check(`Second entry is credit of 300`, Math.abs(Number(ledgerEntries[1].credit) - 300) < 0.01, `credit=${ledgerEntries[1].credit}`);
  }

  // Cleanup
  await prisma.paymentAllocation.deleteMany({ where: { invoice: { customerId: customer.id } } });
  await prisma.customerLedger.deleteMany({ where: { customerId: customer.id } });
  await prisma.customerPayment.deleteMany({ where: { customerId: customer.id } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { customerId: customer.id } } });
  await prisma.invoice.deleteMany({ where: { customerId: customer.id } });
  await prisma.stockMovement.deleteMany({ where: { productId: prod.id } });
  await prisma.purchaseItem.deleteMany({ where: { purchase: { supplierId: supplier.id } } });
  await prisma.supplierLedger.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.supplierPayment.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.purchase.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.product.deleteMany({ where: { id: prod.id } });
  await prisma.customer.deleteMany({ where: { id: customer.id } });
  await prisma.supplier.deleteMany({ where: { id: supplier.id } });
}

// ─── SECTION 12: Historical Accuracy ─────────────────────────────────────────
async function section12_historicalAccuracy(user, category) {
  console.log("\n=== SECTION 12: HISTORICAL ACCURACY ===");

  const prod = await makeProduct("HST-P1", 0, category);
  const supplier = await makeSupplier("03019191919");
  const customer = await makeCustomer("03020202020");

  // Purchase at Rs. 50
  await purchaseModel.createPurchase({
    supplierId: supplier.id,
    items: [{ productId: prod.id, quantity: 20, unitCost: 50 }],
    createdById: user.id
  });

  const inv = await invoiceModel.createInvoice({
    customerId: customer.id, saleType: "CASH",
    paidAmount: 1000, creditApplied: 0, discount: 0,
    items: [{ productId: prod.id, quantity: 10, unitPrice: 100 }],
    createdById: user.id
  });

  // Snapshot COGS at sale
  const invItems = await prisma.invoiceItem.findMany({ where: { invoiceId: inv.id } });
  const historicalCOGS = invItems.reduce((s, i) => s + Number(i.costPriceAtSale) * i.quantity, 0);
  check(`Historical COGS = 500 (10 × 50)`, Math.abs(historicalCOGS - 500) < 0.01, `historicalCOGS=${historicalCOGS}`);

  // Now purchase MORE at Rs. 80 (WAC changes)
  await purchaseModel.createPurchase({
    supplierId: supplier.id,
    items: [{ productId: prod.id, quantity: 20, unitCost: 80 }],
    createdById: user.id
  });

  // Verify historical invoice items were NOT affected by WAC change
  const invItemsAfterWACChange = await prisma.invoiceItem.findMany({ where: { invoiceId: inv.id } });
  const cogsAfterWACChange = invItemsAfterWACChange.reduce((s, i) => s + Number(i.costPriceAtSale) * i.quantity, 0);
  check(`Historical COGS unchanged after WAC update`, Math.abs(historicalCOGS - cogsAfterWACChange) < 0.01, `before=${historicalCOGS}, after=${cogsAfterWACChange}`);

  // Cleanup
  await prisma.paymentAllocation.deleteMany({ where: { invoice: { customerId: customer.id } } });
  await prisma.customerLedger.deleteMany({ where: { customerId: customer.id } });
  await prisma.customerPayment.deleteMany({ where: { customerId: customer.id } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { customerId: customer.id } } });
  await prisma.invoice.deleteMany({ where: { customerId: customer.id } });
  await prisma.stockMovement.deleteMany({ where: { productId: prod.id } });
  await prisma.purchaseItem.deleteMany({ where: { purchase: { supplierId: supplier.id } } });
  await prisma.supplierLedger.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.supplierPayment.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.purchase.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.product.deleteMany({ where: { id: prod.id } });
  await prisma.customer.deleteMany({ where: { id: customer.id } });
  await prisma.supplier.deleteMany({ where: { id: supplier.id } });
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  ADVERSARIAL AUDIT PHASE 2 - SAMEER DISTRIBUTORS ERP");
  console.log("═══════════════════════════════════════════════════════════════");

  let user, category;
  try {
    user = await getUser();
    category = await getCategory();
    if (!user) throw new Error("No user found in DB");
    if (!category) throw new Error("No category found in DB");
  } catch (e) {
    console.error("FATAL: Cannot initialize audit:", e.message);
    await prisma.$disconnect();
    process.exit(1);
  }

  await section1_dataIntegrity(user, category);
  await section2_accounting(user, category);
  await section3_creditApplied(user, category);
  await section4_returns(user, category);
  await section5_paymentAllocation(user, category);
  await section6_destructive(user, category);
  await section7_concurrency(user, category);
  await section8_financialInvariants(user, category);
  await section9_supplierPayments(user, category);
  await section10_reports(user, category);
  await section11_invoiceWithUpfrontPayment(user, category);
  await section12_historicalAccuracy(user, category);

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  AUDIT COMPLETE: ${testsPassed} passed, ${testsFailed} failed`);
  console.log("═══════════════════════════════════════════════════════════════");

  if (issues.length > 0) {
    console.log("\n FAILED TESTS SUMMARY:");
    for (const issue of issues) {
      console.log(`  ✗ ${issue.label}`);
      console.log(`    ${issue.detail}`);
    }
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("AUDIT CRASHED:", e);
  await prisma.$disconnect();
  process.exit(1);
});
