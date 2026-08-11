require("dotenv").config();
const prisma = require("../config/prisma");
const invoiceModel = require("../models/invoice-model");
const purchaseModel = require("../models/purchase-model");
const paymentModel = require("../models/payment-model");
const salesReturnModel = require("../models/sales-return-model");
const purchaseReturnModel = require("../models/purchase-return-model");
const stockModel = require("../models/stock-model");
const ledgerModel = require("../models/ledger-model");
const glModel = require("../models/gl-model");
const reportModel = require("../models/report-model");

async function runDeepAudit() {
  console.log("====================================================================");
  console.log("       STARTING DEEP FIRST-PRINCIPLES ERP SYSTEM AUDIT             ");
  console.log("====================================================================\n");

  const findings = {
    critical: [],
    high: [],
    medium: [],
    low: [],
    accountingViolations: [],
    dataIntegrity: [],
    concurrency: [],
    security: [],
    performance: []
  };

  // ------------------------------------------------------------------
  // 1. EXISTING DATABASE INTEGRITY & INVARIANT RECONCILIATION
  // ------------------------------------------------------------------
  console.log("--> Audit 1: Customer Ledger & Balance Reconciliation...");
  const customers = await prisma.customer.findMany();
  for (const c of customers) {
    const rec = await ledgerModel.reconcileCustomerLedger(c.id);
    if (!rec.inSync) {
      findings.accountingViolations.push({
        title: `Customer Ledger Out-Of-Sync for Customer #${c.id} (${c.name})`,
        details: `Denormalized Balance: ${rec.denormalizedBalance}, Ledger Sum: ${rec.ledgerSum}, Drift: ${rec.drift}, Running Mismatch: ${rec.runningBalanceMismatch}`
      });
    }
    if (rec.invalidReferences.length > 0) {
      findings.dataIntegrity.push({
        title: `Customer Ledger Invalid References for Customer #${c.id}`,
        details: rec.invalidReferences
      });
    }
  }

  console.log("--> Audit 2: Supplier Ledger & Balance Reconciliation...");
  const suppliers = await prisma.supplier.findMany();
  for (const s of suppliers) {
    const rec = await ledgerModel.reconcileSupplierLedger(s.id);
    if (!rec.inSync) {
      findings.accountingViolations.push({
        title: `Supplier Ledger Out-Of-Sync for Supplier #${s.id} (${s.name})`,
        details: `Denormalized Balance: ${rec.denormalizedBalance}, Ledger Sum: ${rec.ledgerSum}, Drift: ${rec.drift}, Running Mismatch: ${rec.runningBalanceMismatch}`
      });
    }
  }

  console.log("--> Audit 3: Stock Movement & Product Quantity Reconciliation...");
  const products = await prisma.product.findMany();
  for (const p of products) {
    const rec = await stockModel.verifyIntegrity(p.id);
    if (!rec.inSync) {
      findings.dataIntegrity.push({
        title: `Stock Quantity Discrepancy for Product #${p.id} (${p.name})`,
        details: `Stock Quantity: ${rec.stockQuantity}, Stock Movement Sum: ${rec.movementTotal}`
      });
    }
  }

  console.log("--> Audit 4: General Ledger Trial Balance Equality...");
  const tb = await glModel.getGLTrialBalance({});
  if (!tb.isBalanced) {
    findings.accountingViolations.push({
      title: "GL Trial Balance Unbalanced",
      details: `Total Debit: ${tb.totalDebit}, Total Credit: ${tb.totalCredit}, Difference: ${Math.abs(tb.totalDebit - tb.totalCredit)}`
    });
  }

  console.log("--> Audit 5: Invoice Equations & Line Item Calculations...");
  const invoices = await prisma.invoice.findMany({ include: { items: true } });
  for (const inv of invoices) {
    const subtotal = Number(inv.subtotal);
    const discount = Number(inv.discount);
    const transportDiscount = Number(inv.transportDiscount);
    const total = Number(inv.total);
    const paidAmount = Number(inv.paidAmount);
    const creditApplied = Number(inv.creditApplied);
    const returnedAmount = Number(inv.returnedAmount);
    const balanceDue = Number(inv.balanceDue);

    // Equation: total = subtotal - discount
    if (Math.abs((subtotal - discount) - total) > 0.01) {
      findings.accountingViolations.push({
        title: `Invoice #${inv.invoiceNo} Total Formula Violation`,
        details: `subtotal (${subtotal}) - discount (${discount}) = ${subtotal - discount} != total (${total})`
      });
    }

    // Equation: balanceDue = total - transportDiscount - paidAmount - creditApplied - returnedAmount
    const expectedBalanceDue = Math.max(0, Math.round((total - transportDiscount - paidAmount - creditApplied - returnedAmount) * 100) / 100);
    if (Math.abs(expectedBalanceDue - balanceDue) > 0.01) {
      findings.accountingViolations.push({
        title: `Invoice #${inv.invoiceNo} Balance Due Formula Violation`,
        details: `Calculated: ${expectedBalanceDue}, Stored: ${balanceDue}`
      });
    }

    // Check sum of item totalPrice vs total
    const itemTotalPriceSum = Math.round(inv.items.reduce((s, it) => s + Number(it.totalPrice), 0) * 100) / 100;
    if (Math.abs(itemTotalPriceSum - total) > 0.01) {
      findings.accountingViolations.push({
        title: `Invoice #${inv.invoiceNo} Line Items Sum Mismatch with Invoice Total`,
        details: `Sum of line item totalPrice (${itemTotalPriceSum}) != Invoice Total (${total})`
      });
    }
  }

  console.log("--> Audit 6: Purchase Equations & Line Item Calculations...");
  const purchases = await prisma.purchase.findMany({ include: { items: true } });
  for (const pur of purchases) {
    const subtotal = Number(pur.subtotal);
    const discount = Number(pur.discount);
    const total = Number(pur.total);
    const paidAmount = Number(pur.paidAmount);
    const creditApplied = Number(pur.creditApplied);
    const returnedAmount = Number(pur.returnedAmount);
    const balanceDue = Number(pur.balanceDue);

    const expectedBalanceDue = Math.max(0, Math.round((total - paidAmount - creditApplied - returnedAmount) * 100) / 100);
    if (Math.abs(expectedBalanceDue - balanceDue) > 0.01) {
      findings.accountingViolations.push({
        title: `Purchase #${pur.purchaseNo} Balance Due Formula Violation`,
        details: `Calculated: ${expectedBalanceDue}, Stored: ${balanceDue}`
      });
    }
  }

  // ------------------------------------------------------------------
  // 2. FIRST-PRINCIPLES TRANSACTION SCENARIO SIMULATIONS
  // ------------------------------------------------------------------
  console.log("\n--> Running First-Principles Business Simulations...");

  const admin = await prisma.user.findFirst();
  const testUserId = admin ? admin.id : 1;

  // Create clean isolated test entities
  const category = await prisma.category.create({ data: { name: `AuditCat_${Date.now()}` } });
  const productA = await prisma.product.create({
    data: {
      name: `AuditProdA_${Date.now()}`,
      categoryId: category.id,
      costPrice: 10,
      sellingPrice: 100,
      weightedAvgCost: 10,
      stockQuantity: 0,
      lowStockLevel: 5
    }
  });

  const productB = await prisma.product.create({
    data: {
      name: `AuditProdB_${Date.now()}`,
      categoryId: category.id,
      costPrice: 20,
      sellingPrice: 200,
      weightedAvgCost: 20,
      stockQuantity: 0,
      lowStockLevel: 5
    }
  });

  const supplier = await prisma.supplier.create({
    data: { name: `AuditSupplier_${Date.now()}`, phone: "123456789", balance: 0 }
  });

  const customer = await prisma.customer.create({
    data: { name: `AuditCustomer_${Date.now()}`, phone: "987654321", balance: 0 }
  });

  // Seed stock for Product A and Product B via initial Purchase
  console.log("   Seeding stock for simulation products...");
  await purchaseModel.createPurchase({
    supplierId: supplier.id,
    paidAmount: 1000,
    items: [
      { productId: productA.id, quantity: 100, unitCost: 10 },
      { productId: productB.id, quantity: 100, unitCost: 20 }
    ],
    createdById: testUserId
  });

  // --- Scenario 1: Double Discount Bug in Invoice Line Items ---
  console.log("   Simulating Invoice with item discount + header discount...");
  try {
    const invWithItemDiscount = await invoiceModel.createInvoice({
      customerId: customer.id,
      saleType: "CREDIT",
      discount: 0, // header discount
      items: [
        { productId: productA.id, quantity: 1, unitPrice: 100, discount: 10 }
      ],
      createdById: testUserId
    });

    const itemRec = await prisma.invoiceItem.findFirst({ where: { invoiceId: invWithItemDiscount.id } });
    console.log(`   [Double-Discount Test] Invoice Total: ${invWithItemDiscount.total}, Item totalPrice: ${itemRec.totalPrice}`);
    if (Number(invWithItemDiscount.total) !== Number(itemRec.totalPrice)) {
      findings.critical.push({
        title: "CRITICAL: Invoice Item Double-Discount Corruption",
        severity: "CRITICAL",
        reproduction: `Create invoice with item.discount = 10, discount = 0. Invoice total = ${invWithItemDiscount.total}, but line item totalPrice = ${itemRec.totalPrice}.`,
        rootCause: "invoice-model.js calculates finalDiscount = discount + totalItemDiscounts, calculates proportionalDiscountShare from finalDiscount, and then line 168 does itemSubtotal - itemDiscount - proportionalDiscountShare, subtracting item.discount TWICE.",
        risk: "Severe financial discrepancy. Line item revenue sums do not match invoice total revenue, corrupting sales returns, COGS reporting, and salesman item-level metrics.",
        fix: "Remove itemDiscount from line 168 calculation or do not include totalItemDiscounts in finalDiscount if item.discount is already subtracted."
      });
    }
  } catch (err) {
    console.error("   Error in double discount simulation:", err.message);
  }

  // --- Scenario 2: Purchase Supplier Ledger Credit Applied Double Add Bug ---
  console.log("   Simulating Supplier Advance Credit Application on Purchase...");
  try {
    // 1. Give supplier advance credit (-500)
    await prisma.supplier.update({ where: { id: supplier.id }, data: { balance: -500 } });
    const suppLedgerBefore = Number((await prisma.supplier.findUnique({ where: { id: supplier.id } })).balance);

    // 2. Create purchase for 1000 applying 500 credit
    const purWithCredit = await purchaseModel.createPurchase({
      supplierId: supplier.id,
      paidAmount: 0,
      creditApplied: 500,
      items: [
        { productId: productA.id, quantity: 100, unitCost: 10 } // 1000 total
      ],
      createdById: testUserId
    });

    const suppLedgerAfter = Number((await prisma.supplier.findUnique({ where: { id: supplier.id } })).balance);
    console.log(`   [Supplier Credit Test] Balance Before: ${suppLedgerBefore}, Purchase Total: ${purWithCredit.total}, Credit Applied: 500, Balance After: ${suppLedgerAfter}`);

    if (suppLedgerAfter !== 500) {
      findings.critical.push({
        title: "CRITICAL: Supplier Ledger Overstated by 2x Credit Applied on Vendor Advance Purchases",
        severity: "CRITICAL",
        reproduction: "Set supplier.balance = -500 (vendor advance). Create purchase for Rs. 1000 with creditApplied = 500. Expected supplier balance after purchase: +500. Actual supplier balance: +" + suppLedgerAfter + ".",
        rootCause: "purchase-model.js lines 255-267 posts a separate recordSupplierLedgerEntry({ credit: creditApplied }), which INCREASES supplier balance by creditApplied instead of reducing/offsetting it, because credit: total ALREADY added the full purchase amount.",
        risk: "Catastrophic overstatement of Supplier Payables. Every time vendor advance credit is applied to a purchase, the ERP records that the company owes the supplier TWICE as much money as it actually does.",
        fix: "Do NOT post a separate recordSupplierLedgerEntry for creditApplied in purchase-model.js."
      });
    }
  } catch (err) {
    console.error("   Error in supplier credit simulation:", err.message);
  }

  // --- Scenario 3: Customer Payment Without Allocation / CustomerDeposit ---
  console.log("   Simulating Unallocated Customer Payment...");
  try {
    const unallocatedPayment = await paymentModel.recordCustomerPayment({
      customerId: customer.id,
      amount: 100,
      allocations: [],
      createdById: testUserId
    });

    const depositsCount = await prisma.customerDeposit.count({ where: { customerId: customer.id } });
    console.log(`   [Unallocated Payment Test] Payment created #${unallocatedPayment.id}. CustomerDeposit rows: ${depositsCount}`);
    if (depositsCount === 0) {
      findings.high.push({
        title: "HIGH: Customer Payments Without Allocations Orphan Funds & Ignore CustomerDeposit Model",
        severity: "HIGH",
        reproduction: "Record a Customer Payment without specifying invoice allocations. Payment is created and CustomerLedger is credited, but CustomerDeposit table is never populated.",
        rootCause: "payment-model.js does not interact with the CustomerDeposit table created in schema.prisma.",
        risk: "Financial reporting disconnect. The schema defines a CustomerDeposit model, but the payment engine bypasses it entirely.",
        fix: "Integrate CustomerDeposit creation whenever a CustomerPayment has unallocated funds."
      });
    }
  } catch (err) {
    console.error("   Error in unallocated payment simulation:", err.message);
  }

  // --- Scenario 4: Return Precision / Fraction Loss on Partial Return ---
  console.log("   Simulating Partial Unit Return Net Price Precision...");
  try {
    const inv3Unit = await invoiceModel.createInvoice({
      customerId: customer.id,
      saleType: "CREDIT",
      items: [{ productId: productA.id, quantity: 3, unitPrice: 33.33 }], // total 99.99
      createdById: testUserId
    });

    const ret1 = await salesReturnModel.createSalesReturn({
      customerId: customer.id,
      invoiceId: inv3Unit.id,
      items: [{ productId: productA.id, quantity: 1 }],
      createdById: testUserId
    });

    const ret2 = await salesReturnModel.createSalesReturn({
      customerId: customer.id,
      invoiceId: inv3Unit.id,
      items: [{ productId: productA.id, quantity: 2 }],
      createdById: testUserId
    });

    const totalRetVal = Number(ret1.totalAmount) + Number(ret2.totalAmount);
    console.log(`   [Partial Return Test] Invoice Total: ${inv3Unit.total}, Return 1: ${ret1.totalAmount}, Return 2: ${ret2.totalAmount}, Total Returned: ${totalRetVal}`);
    if (Math.abs(totalRetVal - Number(inv3Unit.total)) > 0.01) {
      findings.medium.push({
        title: "MEDIUM: Sales Return Net Unit Price Rounding Drifts Total Return Value",
        severity: "MEDIUM",
        reproduction: `Invoice total = ${inv3Unit.total} for 3 units. Returning 1 unit then 2 units yields total return = ${totalRetVal}.`,
        rootCause: "sales-return-model.js calculates netUnitPrice = totalPrice / soldQty. Fractional cents lead to rounding drift when returning items in separate batches.",
        risk: "Small monetary discrepancies in customer balance and sales return totals over high transaction volumes.",
        fix: "On the final return of a line item, set itemTotal = remaining returnable line item total value rather than netUnitPrice * qty."
      });
    }
  } catch (err) {
    console.error("   Error in partial return simulation:", err.message);
  }

  // --- Scenario 5: Security & Authorization Direct Manipulation ---
  console.log("   Checking API Validation & Role Restrictions...");
  const authController = require("../controllers/auth-controller");
  const reqDummy = { body: { name: "Hacker", username: "hacker", password: "p", confirmPassword: "p", registrationSecret: "WRONG" } };
  let authBlocked = false;
  const resDummy = {
    status: (code) => {
      if (code === 403) authBlocked = true;
      return { json: () => {} };
    }
  };
  await authController.register(reqDummy, resDummy);
  if (!authBlocked) {
    findings.security.push({
      title: "SECURITY: Registration Secret Bypassed",
      details: "Auth controller failed to return 403 when registrationSecret was wrong."
    });
  }

  console.log("\n====================================================================");
  console.log("                      AUDIT RESULTS SUMMARY                        ");
  console.log("====================================================================");
  console.log(`Critical Issues:             ${findings.critical.length}`);
  console.log(`High Severity Issues:        ${findings.high.length}`);
  console.log(`Medium Severity Issues:      ${findings.medium.length}`);
  console.log(`Low Severity Issues:         ${findings.low.length}`);
  console.log(`Accounting Violations:       ${findings.accountingViolations.length}`);
  console.log(`Data Integrity Problems:     ${findings.dataIntegrity.length}`);
  console.log(`Security Problems:           ${findings.security.length}`);

  // Print Details of findings
  console.log("\n--- DETAILED FINDINGS ---");
  for (const c of findings.critical) {
    console.log(`\n[CRITICAL ISSUE]: ${c.title}`);
    console.log(`Root Cause: ${c.rootCause}`);
    console.log(`Reproduction: ${c.reproduction}`);
  }
  for (const h of findings.high) {
    console.log(`\n[HIGH ISSUE]: ${h.title}`);
    console.log(`Root Cause: ${h.rootCause}`);
  }
  for (const m of findings.medium) {
    console.log(`\n[MEDIUM ISSUE]: ${m.title}`);
    console.log(`Root Cause: ${m.rootCause}`);
  }
  for (const av of findings.accountingViolations) {
    console.log(`\n[ACCOUNTING VIOLATION]: ${av.title}`);
    console.log(`Details: ${JSON.stringify(av.details)}`);
  }
  for (const di of findings.dataIntegrity) {
    console.log(`\n[DATA INTEGRITY PROBLEM]: ${di.title}`);
    console.log(`Details: ${JSON.stringify(di.details)}`);
  }

  // Cleanup test data
  console.log("\nCleaning up test entities...");
  try {
    const testCategory = await prisma.category.findFirst({ where: { id: category.id } });
    if (testCategory) {
      await prisma.salesReturnItem.deleteMany({ where: { product: { categoryId: category.id } } });
      await prisma.salesReturn.deleteMany({ where: { customerId: customer.id } });
      await prisma.paymentAllocation.deleteMany({ where: { customerPayment: { customerId: customer.id } } });
      await prisma.customerPayment.deleteMany({ where: { customerId: customer.id } });
      await prisma.customerDeposit.deleteMany({ where: { customerId: customer.id } });
      await prisma.invoiceItem.deleteMany({ where: { product: { categoryId: category.id } } });
      await prisma.invoice.deleteMany({ where: { customerId: customer.id } });
      await prisma.supplierPaymentAllocation.deleteMany({ where: { supplierPayment: { supplierId: supplier.id } } });
      await prisma.supplierPayment.deleteMany({ where: { supplierId: supplier.id } });
      await prisma.purchaseReturnItem.deleteMany({ where: { product: { categoryId: category.id } } });
      await prisma.purchaseReturn.deleteMany({ where: { supplierId: supplier.id } });
      await prisma.purchaseItem.deleteMany({ where: { product: { categoryId: category.id } } });
      await prisma.purchase.deleteMany({ where: { supplierId: supplier.id } });
      await prisma.customerLedger.deleteMany({ where: { customerId: customer.id } });
      await prisma.supplierLedger.deleteMany({ where: { supplierId: supplier.id } });
      await prisma.stockMovement.deleteMany({ where: { productId: { in: [productA.id, productB.id] } } });
      await prisma.product.deleteMany({ where: { categoryId: category.id } });
      await prisma.category.delete({ where: { id: category.id } });
      await prisma.customer.delete({ where: { id: customer.id } });
      await prisma.supplier.delete({ where: { id: supplier.id } });
      console.log("Cleanup completed.");
    }
  } catch (e) {
    console.error("Cleanup error:", e.message);
  }

  return findings;
}

runDeepAudit().then((f) => {
  console.log("\nDeep Audit Finished Successfully.");
  process.exit(0);
}).catch((err) => {
  console.error("Fatal error during deep audit script execution:", err);
  process.exit(1);
});
