require("../config/env");
const prisma = require("../config/prisma");
const purchaseModel = require("../models/purchase-model");
const invoiceModel = require("../models/invoice-model");
const fifoCostModel = require("../models/fifo-cost-model");

async function runFIFOTest() {
  console.log("=================================================================");
  console.log("TESTING FIFO COST ENGINE WITH PRODUCT OWNER'S SCENARIO");
  console.log("Scenario: Buy 100 @ 90, Buy 100 @ 80, Sell 50, then Sell 70");
  console.log("=================================================================");

  // 1. Setup user, customer, supplier, category, product
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  let supplier = await prisma.supplier.findFirst({ where: { isActive: true } });
  if (!supplier) {
    supplier = await prisma.supplier.create({ data: { name: "Test FIFO Supplier", balance: 0 } });
  }

  let customer = await prisma.customer.findFirst({ where: { isActive: true } });
  if (!customer) {
    customer = await prisma.customer.create({ data: { name: "Test FIFO Customer", balance: 0 } });
  }

  let category = await prisma.category.findFirst({ where: { isActive: true } });
  if (!category) {
    category = await prisma.category.create({ data: { name: "General Test Category" } });
  }

  // Create isolated test product
  const testProduct = await prisma.product.create({
    data: {
      name: `FIFO Test Diaper M ${Date.now()}`,
      size: "M",
      categoryId: category.id,
      costPrice: 90,
      sellingPrice: 100,
      stockQuantity: 0,
    }
  });

  console.log(`Created test product: ${testProduct.name} (ID: ${testProduct.id})`);

  // 2. Record Purchase 1: 100 pcs @ Rs. 90
  console.log("\n1. Ingesting Purchase #1: 100 pcs @ Rs. 90...");
  const purchase1 = await purchaseModel.createPurchase({
    supplierId: supplier.id,
    purchaseDate: new Date("2026-08-01"),
    items: [
      {
        productId: testProduct.id,
        quantity: 100,
        unitCost: 90,
        discount: 0,
      }
    ],
    paidAmount: 9000,
    createdById: admin.id,
  });
  console.log(`✓ Purchase #1 recorded: ${purchase1.purchaseNo}, Total: Rs. ${purchase1.total}`);

  // 3. Record Purchase 2: 100 pcs @ Rs. 80
  console.log("\n2. Ingesting Purchase #2: 100 pcs @ Rs. 80...");
  const purchase2 = await purchaseModel.createPurchase({
    supplierId: supplier.id,
    purchaseDate: new Date("2026-08-02"),
    items: [
      {
        productId: testProduct.id,
        quantity: 100,
        unitCost: 80,
        discount: 0,
      }
    ],
    paidAmount: 8000,
    createdById: admin.id,
  });
  console.log(`✓ Purchase #2 recorded: ${purchase2.purchaseNo}, Total: Rs. ${purchase2.total}`);

  // Verify cost layers in database
  const layersAfterPurchases = await prisma.inventoryCostLayer.findMany({
    where: { productId: testProduct.id },
    orderBy: { receivedDate: "asc" },
  });
  console.log("\nInventory Cost Layers on Hand:");
  layersAfterPurchases.forEach((l, i) => {
    console.log(`  Layer #${i + 1}: ${l.remainingQuantity}/${l.initialQuantity} pcs @ Rs. ${l.unitCost} (Received: ${l.receivedDate.toISOString().split("T")[0]})`);
  });

  // 4. Sale 1: Sell 50 pcs @ Rs. 100
  console.log("\n3. Selling 50 pcs @ Rs. 100 (should consume strictly from Layer #1 @ 90)...");
  const invoice1 = await invoiceModel.createInvoice({
    customerId: customer.id,
    saleType: "CASH",
    paidAmount: 5000,
    documentStatus: "POSTED",
    items: [
      {
        productId: testProduct.id,
        quantity: 50,
        unitPrice: 100,
        discount: 0,
      }
    ],
    createdById: admin.id,
  });

  const inv1Item = await prisma.invoiceItem.findFirst({
    where: { invoiceId: invoice1.id, productId: testProduct.id }
  });

  const expectedCOGS1 = 50 * 90; // 4500
  const actualCOGS1 = 50 * Number(inv1Item.costPriceAtSale);
  const actualProfit1 = 5000 - actualCOGS1;

  console.log(`✓ Invoice #1 confirmed: ${invoice1.invoiceNo}`);
  console.log(`  - costPriceAtSale snapshot: Rs. ${inv1Item.costPriceAtSale}`);
  console.log(`  - Total COGS: Rs. ${actualCOGS1} (Expected: Rs. ${expectedCOGS1})`);
  console.log(`  - True Net Profit: Rs. ${actualProfit1} (Expected: Rs. 500)`);

  if (actualCOGS1 !== expectedCOGS1) {
    throw new Error(`COGS mismatch on Sale 1! Expected ${expectedCOGS1}, got ${actualCOGS1}`);
  }

  // 5. Sale 2: Sell 70 pcs @ Rs. 100 (50 from Layer #1 @ 90, 20 from Layer #2 @ 80)
  console.log("\n4. Selling 70 pcs @ Rs. 100 (should consume remaining 50 from Layer #1 @ 90 + 20 from Layer #2 @ 80)...");
  const invoice2 = await invoiceModel.createInvoice({
    customerId: customer.id,
    saleType: "CASH",
    paidAmount: 7000,
    documentStatus: "POSTED",
    items: [
      {
        productId: testProduct.id,
        quantity: 70,
        unitPrice: 100,
        discount: 0,
      }
    ],
    createdById: admin.id,
  });

  const inv2Item = await prisma.invoiceItem.findFirst({
    where: { invoiceId: invoice2.id, productId: testProduct.id }
  });

  const expectedCOGS2 = (50 * 90) + (20 * 80); // 4500 + 1600 = 6100
  const actualCOGS2 = Math.round(70 * Number(inv2Item.costPriceAtSale));
  const actualProfit2 = 7000 - actualCOGS2;

  console.log(`✓ Invoice #2 confirmed: ${invoice2.invoiceNo}`);
  console.log(`  - costPriceAtSale snapshot: Rs. ${inv2Item.costPriceAtSale}`);
  console.log(`  - Total COGS: Rs. ${actualCOGS2} (Expected: Rs. ${expectedCOGS2})`);
  console.log(`  - True Net Profit: Rs. ${actualProfit2} (Expected: Rs. 900)`);

  if (actualCOGS2 !== expectedCOGS2) {
    throw new Error(`COGS mismatch on Sale 2! Expected ${expectedCOGS2}, got ${actualCOGS2}`);
  }

  // 6. Check final inventory valuation
  const valuation = await fifoCostModel.getInventoryValuation(testProduct.id);
  const expectedRemainingValuation = 80 * 80; // 6400
  console.log(`\n5. Remaining Inventory Valuation on Hand: Rs. ${valuation.totalValuation} (Expected: Rs. ${expectedRemainingValuation})`);

  if (valuation.totalValuation !== expectedRemainingValuation) {
    throw new Error(`Valuation mismatch! Expected ${expectedRemainingValuation}, got ${valuation.totalValuation}`);
  }

  console.log("\n=================================================================");
  console.log("🎉 ALL FIFO COST ENGINE VERIFICATION TESTS PASSED 100%!");
  console.log("=================================================================");
}

runFIFOTest()
  .catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
