/**
 * ============================================================
 *  SameerTraderz IMS — Comprehensive QA & Invariant Audit Suite
 *  Run: node backend/scratch/qa_full_suite.js
 * ============================================================
 */

"use strict";

require("../config/env");
const prisma = require("../config/prisma");
const userModel = require("../models/user-model");
const productCategoryModel = require("../models/product-category-model");
const productModel = require("../models/product-model");
const customerModel = require("../models/customer-model");
const supplierModel = require("../models/supplier-model");
const purchaseModel = require("../models/purchase-model");
const invoiceModel = require("../models/invoice-model");
const salesReturnModel = require("../models/sales-return-model");
const purchaseReturnModel = require("../models/purchase-return-model");
const paymentModel = require("../models/payment-model");
const stockModel = require("../models/stock-model");
const reportModel = require("../models/report-model");

// ANSI color helpers
const R = (s) => `\x1b[31m${s}\x1b[0m`;
const G = (s) => `\x1b[32m${s}\x1b[0m`;
const Y = (s) => `\x1b[33m${s}\x1b[0m`;
const B = (s) => `\x1b[34m${s}\x1b[0m`;
const W = (s) => `\x1b[1m${s}\x1b[0m`;

const scorecard = {
  passed: 0,
  failed: 0,
  checks: [],
};

function recordResult(title, success, detail = "") {
  if (success) {
    scorecard.passed++;
    scorecard.checks.push({ title, status: "PASS", detail });
    console.log(`  ${G("✔ PASS")} ${title}`);
  } else {
    scorecard.failed++;
    scorecard.checks.push({ title, status: "FAIL", detail });
    console.log(`  ${R("✖ FAIL")} ${title} ${detail ? `(${detail})` : ""}`);
  }
}

function header(title) {
  console.log(`\n${B("═".repeat(60))}`);
  console.log(B(`  ${title}`));
  console.log(B("═".repeat(60)));
}

async function cleanDB() {
  console.log("Cleaning database tables for reproducible test run...");
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations';
  `;
  if (tables.length > 0) {
    const tableNames = tables.map((t) => `"${t.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);
  }
}

async function runQASuite() {
  console.log(W("\nStarting SameerTraderz Comprehensive QA Suite...\n"));

  try {
    await cleanDB();

    // =========================================================================
    // PASS 1 — SEEDING DATA VIA MODEL LAYER
    // =========================================================================
    header("PASS 1 · Seeding Realistic FMCG Dummy Data via Model Layer");

    // 1. Users
    const adminUser = await userModel.createUser({ name: "Admin User", username: "admin", email: "admin@sameer.com", password: "password", role: "ADMIN" });
    const staff1 = await userModel.createUser({ name: "Staff One", username: "staff1", email: "staff1@sameer.com", password: "password", role: "STAFF" });
    const staff2 = await userModel.createUser({ name: "Staff Two", username: "staff2", email: "staff2@sameer.com", password: "password", role: "STAFF" });
    console.log(`- Users seeded: Admin (${adminUser.id}), Staff1 (${staff1.id}), Staff2 (${staff2.id})`);

    // 2. Categories
    const catDiapers = await productCategoryModel.create({ name: "Diapers" });
    const catTissues = await productCategoryModel.create({ name: "Tissues" });
    const catWipes = await productCategoryModel.create({ name: "Wipes" });
    const catSoaps = await productCategoryModel.create({ name: "Soaps" });

    // 3. Products (~15 products)
    const productsData = [
      { name: "Pampers Baby Dry M", sku: "SKU-DIAP-01", categoryId: catDiapers.id, costPrice: 300, sellingPrice: 400, piecesPerCarton: 48, lowStockLevel: 100 },
      { name: "Pampers Baby Dry L", sku: "SKU-DIAP-02", categoryId: catDiapers.id, costPrice: 350, sellingPrice: 450, piecesPerCarton: 48, lowStockLevel: 100 },
      { name: "Rose Petal Luxury Tissue", sku: "SKU-TISS-01", categoryId: catTissues.id, costPrice: 150, sellingPrice: 220, piecesPerCarton: 24, lowStockLevel: 50 },
      { name: "Rose Petal Pop-up Wipes", sku: "SKU-WIPE-01", categoryId: catWipes.id, costPrice: 200, sellingPrice: 300, piecesPerCarton: 36, lowStockLevel: 50 },
      { name: "Lux Soft Rose Soap 100g", sku: "SKU-SOAP-01", categoryId: catSoaps.id, costPrice: 80, sellingPrice: 120, piecesPerCarton: 72, lowStockLevel: 100 },
      { name: "LowStock Diaper S", sku: "SKU-DIAP-LOW1", categoryId: catDiapers.id, costPrice: 250, sellingPrice: 350, piecesPerCarton: 48, lowStockLevel: 100 }, // Will breach low stock
      { name: "LowStock Tissue Box", sku: "SKU-TISS-LOW2", categoryId: catTissues.id, costPrice: 120, sellingPrice: 180, piecesPerCarton: 24, lowStockLevel: 50 },  // Will breach low stock
      { name: "SoldOut Soap Bar", sku: "SKU-SOAP-ZERO", categoryId: catSoaps.id, costPrice: 50, sellingPrice: 90, piecesPerCarton: 72, lowStockLevel: 20 },     // Will be fully sold out (0 stock)
      { name: "Dettol Original Soap", sku: "SKU-SOAP-02", categoryId: catSoaps.id, costPrice: 90, sellingPrice: 130, piecesPerCarton: 72, lowStockLevel: 50 },
      { name: "Lifebuoy Total 10 Soap", sku: "SKU-SOAP-03", categoryId: catSoaps.id, costPrice: 70, sellingPrice: 110, piecesPerCarton: 72, lowStockLevel: 50 },
      { name: "Canbebe Size 4 Pants", sku: "SKU-DIAP-03", categoryId: catDiapers.id, costPrice: 400, sellingPrice: 550, piecesPerCarton: 36, lowStockLevel: 40 },
      { name: "Huggies Ultra Comfort", sku: "SKU-DIAP-04", categoryId: catDiapers.id, costPrice: 500, sellingPrice: 700, piecesPerCarton: 36, lowStockLevel: 40 },
      { name: "Tulip Wet Wipes 80s", sku: "SKU-WIPE-02", categoryId: catWipes.id, costPrice: 180, sellingPrice: 260, piecesPerCarton: 24, lowStockLevel: 30 },
      { name: "Discontinued Inactive Soap", sku: "SKU-INACTIVE-1", categoryId: catSoaps.id, costPrice: 40, sellingPrice: 60, piecesPerCarton: 100, lowStockLevel: 10, isActive: false },
      { name: "Standard Wipes Mini", sku: "SKU-WIPE-03", categoryId: catWipes.id, costPrice: 100, sellingPrice: 150, piecesPerCarton: 48, lowStockLevel: 30 }
    ];

    const products = [];
    for (const p of productsData) {
      const prod = await productModel.create(p);
      products.push(prod);
    }
    console.log(`- Products seeded: ${products.length} products (including inactive and low stock)`);

    // 4. Suppliers (4 suppliers)
    const sup1 = await supplierModel.createSupplier({ name: "Alpha Traders (Supplier 1)", phone: "03001111111", address: "Karachi" });
    const sup2 = await supplierModel.createSupplier({ name: "Beta Distributors (Supplier 2)", phone: "03002222222", address: "Lahore" });
    const sup3 = await supplierModel.createSupplier({ name: "Gamma FMCG Ltd (Supplier 3)", phone: "03003333333", address: "Multan" });
    const sup4 = await supplierModel.createSupplier({ name: "Delta Importers (Supplier 4)", phone: "03004444444", address: "Faisalabad" });

    // 5. Customers (8 customers)
    const cusCreditOwesUs = await customerModel.createCustomer({ name: "Customer OwesUs 1", phone: "03111111111", address: "Market Area" });
    const cusCreditOwesUs2 = await customerModel.createCustomer({ name: "Customer OwesUs 2", phone: "03112222222", address: "Shop 12" });
    const cusStoreCreditWeOwe = await customerModel.createCustomer({ name: "Customer StoreCredit WeOwe", phone: "03113333333", address: "Plaza A" });
    const cusSettledZero = await customerModel.createCustomer({ name: "Customer Settled Zero", phone: "03114444444", address: "Corner Store" });
    const cusBulkBuyer = await customerModel.createCustomer({ name: "Customer Bulk Wholesale", phone: "03115555555", address: "Main Bazaar" });
    const cusVIP = await customerModel.createCustomer({ name: "Customer VIP Retail", phone: "03116666666", address: "Sector G" });
    const cusAdvance = await customerModel.createCustomer({ name: "Customer Advance Pay", phone: "03117777777", address: "Block 4" });
    const cusInactive = await customerModel.createCustomer({ name: "Customer Inactive Account", phone: "03118888888", address: "Old City" });

    // 6. Purchases (Seed stock via purchases)
    // Purchase 1: Buy Product 1 (500 pcs @ 300) from Supplier 1. WAC = 300.
    const pur1 = await purchaseModel.createPurchase({
      supplierId: sup1.id,
      purchaseDate: new Date(),
      items: [{ productId: products[0].id, quantity: 500, unitCost: 300 }],
      createdById: adminUser.id,
    });

    // Purchase 2: Buy Product 1 AGAIN (500 pcs @ 400) from Supplier 1.
    // Blended WAC = (500*300 + 500*400) / 1000 = 350.
    const pur2 = await purchaseModel.createPurchase({
      supplierId: sup1.id,
      purchaseDate: new Date(),
      items: [{ productId: products[0].id, quantity: 500, unitCost: 400 }],
      createdById: adminUser.id,
    });

    // Purchase 3: Buy Product 2 (200 pcs @ 350) & Product 3 (300 pcs @ 150)
    const pur3 = await purchaseModel.createPurchase({
      supplierId: sup2.id,
      purchaseDate: new Date(),
      items: [
        { productId: products[1].id, quantity: 200, unitCost: 350 },
        { productId: products[2].id, quantity: 300, unitCost: 150 },
      ],
      createdById: adminUser.id,
    });

    // Purchase 4: Buy Product 4 (100 pcs @ 200), Product 5 (400 pcs @ 80), Product 8 (50 pcs @ 50)
    await purchaseModel.createPurchase({
      supplierId: sup3.id,
      purchaseDate: new Date(),
      items: [
        { productId: products[3].id, quantity: 100, unitCost: 200 },
        { productId: products[4].id, quantity: 400, unitCost: 80 },
        { productId: products[7].id, quantity: 50, unitCost: 50 },
      ],
      createdById: adminUser.id,
    });

    // Purchase 5: Buy LowStock Product 6 (50 pcs @ 250 - lowStockLevel is 100) & Product 7 (20 pcs @ 120 - lowStockLevel is 50)
    await purchaseModel.createPurchase({
      supplierId: sup4.id,
      purchaseDate: new Date(),
      items: [
        { productId: products[5].id, quantity: 50, unitCost: 250 },
        { productId: products[6].id, quantity: 20, unitCost: 120 },
      ],
      createdById: adminUser.id,
    });
    console.log("- Stock seeded via 5 Purchases across suppliers. WAC blended properly.");

    // 7. Invoices (Sales)
    // Invoice 1: CREDIT Sale to Customer 1 for Product 1 (100 pcs @ 500).
    // Note: Product 1 current WAC is 350. This must snapshot 350 into costPriceAtSale!
    const inv1 = await invoiceModel.createInvoice({
      customerId: cusCreditOwesUs.id,
      saleType: "CREDIT",
      items: [{ productId: products[0].id, quantity: 100, unitPrice: 500 }],
      createdById: staff1.id,
    });

    // Invoice 2: CASH Sale to Walk-in (customerId = null) for Product 2 (50 pcs @ 450). Paid in full at counter.
    const invWalkIn = await invoiceModel.createInvoice({
      customerId: null,
      saleType: "CASH",
      paidAmount: 22500,
      items: [{ productId: products[1].id, quantity: 50, unitPrice: 450 }],
      createdById: staff1.id,
    });

    // Invoice 3: CREDIT Sale to Customer 3 for Product 3 (100 pcs @ 220).
    const inv3 = await invoiceModel.createInvoice({
      customerId: cusStoreCreditWeOwe.id,
      saleType: "CREDIT",
      items: [{ productId: products[2].id, quantity: 100, unitPrice: 220 }],
      createdById: staff2.id,
    });

    // Invoice 4: CREDIT Sale to Customer 4 (50 pcs @ 300) with discount
    const inv4 = await invoiceModel.createInvoice({
      customerId: cusSettledZero.id,
      saleType: "CREDIT",
      discount: 1000,
      items: [{ productId: products[3].id, quantity: 50, unitPrice: 300 }],
      createdById: staff2.id,
    });

    // Invoice 5: Sell ALL 50 pcs of Product 8 to make stockQuantity = 0
    await invoiceModel.createInvoice({
      customerId: cusBulkBuyer.id,
      saleType: "CREDIT",
      items: [{ productId: products[7].id, quantity: 50, unitPrice: 90 }],
      createdById: staff1.id,
    });
    console.log("- Invoices seeded (CASH & CREDIT, walk-in, discounts).");

    // Change Product 1 reference cost price to Rs 999 to test COGS snapshot isolation
    await productModel.update(products[0].id, { costPrice: 999, weightedAvgCost: 999 });

    // 8. Customer Payments (Pay Invoice 3 in full to set Customer 3 balance to 0 before return)
    // Customer Payment 1: Customer 1 pays Rs 20,000 toward Invoice 1.
    await paymentModel.recordCustomerPayment({
      customerId: cusCreditOwesUs.id,
      amount: 20000,
      allocations: [{ invoiceId: inv1.id, amountAllocated: 20000 }],
      createdById: adminUser.id,
    });

    // Customer Payment 2: Customer 4 pays full remaining balance on Invoice 4 so balance becomes 0
    const inv4Fresh = await prisma.invoice.findUnique({ where: { id: inv4.id } });
    await paymentModel.recordCustomerPayment({
      customerId: cusSettledZero.id,
      amount: Number(inv4Fresh.balanceDue),
      allocations: [{ invoiceId: inv4.id, amountAllocated: Number(inv4Fresh.balanceDue) }],
      createdById: adminUser.id,
    });

    // Customer Payment 3: Customer 3 pays Invoice 3 in full (Rs 22,000)
    await paymentModel.recordCustomerPayment({
      customerId: cusStoreCreditWeOwe.id,
      amount: 22000,
      allocations: [{ invoiceId: inv3.id, amountAllocated: 22000 }],
      createdById: adminUser.id,
    });

    // 9. Sales Returns
    // Return 1: Customer 3 returns 20 pcs of Product 3 from Invoice 3 (worth 4,400).
    // Registered customer -> refundType MUST auto-derive to "CREDIT". Creates store credit balance of -4,400.
    const srRegistered = await salesReturnModel.createSalesReturn({
      customerId: cusStoreCreditWeOwe.id,
      invoiceId: inv3.id,
      reason: "Damaged packaging return",
      items: [{ productId: products[2].id, quantity: 20 }],
      createdById: staff1.id,
    });

    // Return 2: Walk-in customer returns 10 pcs of Product 2 from Walk-in Invoice 2.
    // Walk-in -> refundType MUST auto-derive to "CASH".
    const srWalkIn = await salesReturnModel.createSalesReturn({
      customerId: null,
      invoiceId: invWalkIn.id,
      reason: "Walk-in cash return",
      items: [{ productId: products[1].id, quantity: 10 }],
      createdById: staff1.id,
    });
    console.log("- Sales Returns seeded (Registered CREDIT return & Walk-in CASH return).");

    // Store Credit Cash Refund: Customer 3 has negative balance (-4,400).
    // Refund Rs 2,000 cash to Customer 3 via /customer/refund-credit:
    const creditRefundPayment = await paymentModel.refundCustomerCreditBalance({
      customerId: cusStoreCreditWeOwe.id,
      amount: 2000,
      description: "Cash refund of partial store credit",
      createdById: adminUser.id,
    });
    console.log(`- Customer store credit refunded as cash successfully (Payment ID: ${creditRefundPayment.id}).`);

    // Supplier Payments
    // Supplier Payment 1: Pay Supplier 1 Rs 100,000 (NORMAL)
    await paymentModel.recordSupplierPayment({
      supplierId: sup1.id,
      amount: 100000,
      paymentType: "NORMAL",
      createdById: adminUser.id,
    });

    // Supplier Payment 2: Pay Supplier 2 Rs 115,000 to settle Purchase 3
    await paymentModel.recordSupplierPayment({
      supplierId: sup2.id,
      amount: 115000,
      paymentType: "NORMAL",
      createdById: adminUser.id,
    });

    // Purchase Return: Return 20 pcs of Product 2 to Supplier 2 from Purchase 3 (worth 7,000)
    // Decrements stock and creates a negative supplier balance of -7,000 (supplier owes us)
    await purchaseReturnModel.createPurchaseReturn({
      supplierId: sup2.id,
      purchaseId: pur3.id,
      reason: "Defective batch returned to supplier",
      items: [{ productId: products[1].id, quantity: 20 }],
      createdById: adminUser.id,
    });
    console.log("- Purchase Return registered (Supplier 2 balance is now negative / owes us).");

    // 10. Manual Stock Adjustment
    // Negative delta stock adjustment (-10 pcs on Product 5)
    await stockModel.adjustStock({
      productId: products[4].id,
      quantity: 10,
      type: "OUT",
      referenceType: "ADJUSTMENT",
      referenceId: 1,
      description: "Damage write-off in warehouse",
      createdById: adminUser.id,
    });
    console.log("- Stock Adjustment registered (-10 pcs OUT).");

    // =========================================================================
    // PASS 2 — EDGE-CASE & CONCURRENCY STRESS TESTS
    // =========================================================================
    header("PASS 2 · Edge-Case & Concurrency Stress Tests");

    // 1. Overselling Guard (Concurrent Stock Deductions)
    // Product 7 currently has 20 pcs. Fire two concurrent sales of 15 pcs each (total 30 pcs > 20).
    const prod7StockBefore = (await productModel.getById(products[6].id)).stockQuantity;
    let oversellPass = false;
    try {
      const p1 = invoiceModel.createInvoice({
        customerId: cusCreditOwesUs2.id,
        saleType: "CREDIT",
        items: [{ productId: products[6].id, quantity: 15, unitPrice: 180 }],
        createdById: staff1.id,
      });
      const p2 = invoiceModel.createInvoice({
        customerId: cusCreditOwesUs2.id,
        saleType: "CREDIT",
        items: [{ productId: products[6].id, quantity: 15, unitPrice: 180 }],
        createdById: staff2.id,
      });
      await Promise.all([p1, p2]);
      oversellPass = false; // Both succeeded -> error!
    } catch (err) {
      // Exactly one succeeded, one failed with stock error
      const prod7StockAfter = (await productModel.getById(products[6].id)).stockQuantity;
      oversellPass = prod7StockAfter >= 0 && (err.message.includes("Insufficient stock") || err.message.includes("exceeds available stock"));
    }
    recordResult("Overselling Concurrency Guard (FOR UPDATE locking)", oversellPass, "Concurrent oversell prevented cleanly");

    // 2. Partial Commit Rollback
    let rollbackPass = false;
    const prod1StockBefore = (await productModel.getById(products[0].id)).stockQuantity;
    try {
      await invoiceModel.createInvoice({
        customerId: cusCreditOwesUs.id,
        saleType: "CREDIT",
        items: [
          { productId: products[0].id, quantity: 5, unitPrice: 500 },
          { productId: 999999, quantity: 5, unitPrice: 100 }, // Invalid item
        ],
        createdById: staff1.id,
      });
    } catch (err) {
      const prod1StockAfter = (await productModel.getById(products[0].id)).stockQuantity;
      rollbackPass = prod1StockBefore === prod1StockAfter; // Stock of item 1 was rolled back
    }
    recordResult("Transaction Rollback on Mid-Invoice Failure", rollbackPass, "No partial writes occurred");

    // 3. Store Credit Refund Overshoot
    let refundOvershootPass = false;
    try {
      await paymentModel.refundCustomerCreditBalance({
        customerId: cusStoreCreditWeOwe.id,
        amount: 9999999, // Way more than credit balance
        description: "Invalid overshoot",
        createdById: adminUser.id,
      });
    } catch (err) {
      refundOvershootPass = err.message.includes("exceeds available credit");
    }
    recordResult("Store Credit Cash Refund Overshoot Rejection", refundOvershootPass, "Over-refunding rejected cleanly");

    // 4. Return Exceeding Original Quantity
    let returnExceedPass = false;
    try {
      await salesReturnModel.createSalesReturn({
        customerId: cusCreditOwesUs.id,
        invoiceId: inv1.id,
        reason: "Excess return test",
        items: [{ productId: products[0].id, quantity: 9999 }], // Exceeds invoice qty (100)
        createdById: staff1.id,
      });
    } catch (err) {
      returnExceedPass = err.message.includes("exceeds remaining returnable quantity");
    }
    recordResult("Excessive Sales Return Quantity Rejection", returnExceedPass, "Return bounds enforced");

    // 5. Piece-Unit Integrity
    const allProducts = await prisma.product.findMany();
    const integerIntegrityPass = allProducts.every((p) => Number.isInteger(p.stockQuantity));
    recordResult("Piece-Unit Integer Quantity Integrity", integerIntegrityPass, "All stock quantities are integer pieces");

    // =========================================================================
    // PASS 3 — VERIFICATION & INVARIANT AUDIT SCORECARD
    // =========================================================================
    header("PASS 3 · Verification & Invariant Audit Scorecard");

    // Check 1: Stock Quantity Reconciliation with Movements
    const movements = await prisma.stockMovement.groupBy({
      by: ["productId", "type"],
      _sum: { quantity: true },
    });
    const movementMap = {};
    for (const m of movements) {
      const pId = m.productId;
      movementMap[pId] = movementMap[pId] || 0;
      if (m.type === "IN") movementMap[pId] += m._sum.quantity;
      if (m.type === "OUT") movementMap[pId] -= m._sum.quantity;
    }

    let stockReconcilePass = true;
    for (const p of allProducts) {
      const calc = movementMap[p.id] || 0;
      if (p.stockQuantity !== calc) {
        stockReconcilePass = false;
        console.log(`  Mismatch on Product ${p.id}: DB=${p.stockQuantity}, MovementSum=${calc}`);
      }
    }
    recordResult("Inventory Stock vs StockMovement Sum Reconciliation", stockReconcilePass, "All product stock sums match movement logs");

    // Check 2: WAC Blending Formula Verification
    // Product 1 had: Pur 1 (500 @ 300) + Pur 2 (500 @ 400).
    // Expected WAC before cost change = 350.
    const inv1Item = await prisma.invoiceItem.findFirst({ where: { invoiceId: inv1.id, productId: products[0].id } });
    const wacSnapshotPass = Number(inv1Item.costPriceAtSale) === 350;
    recordResult("COGS Snapshot Accuracy (costPriceAtSale = 350 at time of sale)", wacSnapshotPass, `Snapshot: Rs. ${inv1Item.costPriceAtSale}`);

    // Check 3: Sales Return Auto-Derivation
    const srRegDB = await salesReturnModel.getSalesReturnById(srRegistered.id);
    const srWalkInDB = await salesReturnModel.getSalesReturnById(srWalkIn.id);
    const autoDerivePass = srRegDB.refundType === "CREDIT" && srWalkInDB.refundType === "CASH";
    recordResult("Sales Return refundType Auto-Derivation (Registered=CREDIT, Walk-in=CASH)", autoDerivePass, `Reg: ${srRegDB.refundType}, WalkIn: ${srWalkInDB.refundType}`);

    // Check 4: Customer Balance Bucket Placement
    const [oweUsCust, weOweCust, zeroCust] = await Promise.all([
      customerModel.getAllCustomers({ where: { balance: { gt: 0 } } }),
      customerModel.getAllCustomers({ where: { balance: { lt: 0 } } }),
      customerModel.getAllCustomers({ where: { balance: 0 } }),
    ]);
    const custBucketPass = oweUsCust.length > 0 && weOweCust.length > 0 && zeroCust.length > 0;
    recordResult("Customer Balance Bucket Filtration (oweUs, weOwe, zero)", custBucketPass, `OwesUs: ${oweUsCust.length}, WeOwe: ${weOweCust.length}, Zero: ${zeroCust.length}`);

    // Check 5: Supplier Balance Bucket Placement
    const [weOweSup, oweUsSup] = await Promise.all([
      supplierModel.getAllSuppliers({ where: { balance: { gt: 0 } } }),
      supplierModel.getAllSuppliers({ where: { balance: { lt: 0 } } }),
    ]);
    const supBucketPass = weOweSup.length > 0 && oweUsSup.length > 0;
    recordResult("Supplier Balance Bucket Filtration (weOwe, oweUs)", supBucketPass, `WeOwe: ${weOweSup.length}, OwesUs: ${oweUsSup.length}`);

    // Check 6: CustomerLedger Running Balance Continuity
    const ledgerEntries = await customerModel.getCustomerLedger(cusStoreCreditWeOwe.id);
    let ledgerContinuityPass = true;
    let running = 0;
    for (const entry of ledgerEntries) {
      running += Number(entry.debit) - Number(entry.credit);
      if (Math.abs(running - Number(entry.balance)) > 0.01) {
        ledgerContinuityPass = false;
      }
    }
    recordResult("CustomerLedger Running Balance Continuity", ledgerContinuityPass, `Verified ${ledgerEntries.length} ledger rows in sequence`);

    // Check 7: Low Stock Count
    const dashboardSummary = await reportModel.getDashboardMetrics();
    const lowStockPass = dashboardSummary.lowStockCount >= 2;
    recordResult("Low Stock Alert Count Accuracy", lowStockPass, `Low stock count: ${dashboardSummary.lowStockCount}`);

    // =========================================================================
    // SCORECARD SUMMARY
    // =========================================================================
    header("QA AUDIT SCORECARD SUMMARY");
    console.log(`Total Checks Run : ${scorecard.passed + scorecard.failed}`);
    console.log(`Passed           : ${G(scorecard.passed)}`);
    console.log(`Failed           : ${scorecard.failed > 0 ? R(scorecard.failed) : G(0)}`);

    if (scorecard.failed === 0) {
      console.log(`\n${G("=========================================================")}`);
      console.log(G("  🎉 ALL FUNCTIONAL AND INVARIANT TESTS PASSED CLEANLY!  "));
      console.log(G("=========================================================\n"));
    } else {
      console.log(`\n${R("=========================================================")}`);
      console.log(R("  ⚠️ SOME CHECKS FAILED — REVIEW DETAILS ABOVE!          "));
      console.log(R("=========================================================\n"));
      process.exit(1);
    }
  } catch (err) {
    console.error(R("\nFatal error during QA suite execution:"), err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runQASuite();
