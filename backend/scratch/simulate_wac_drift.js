require("dotenv").config();
const prisma = require("../config/prisma");
const purchaseModel = require("../models/purchase-model");
const purchaseReturnModel = require("../models/purchase-return-model");

async function main() {
  console.log("=== STARTING WAC VALUATION DRIFT AUDIT ===");

  try {
    const user = await prisma.user.findFirst();
    if (!user) throw new Error("No user found.");

    const supplier = await prisma.supplier.create({
      data: { name: "WAC Supplier", phone: "03003333333", balance: 0 }
    });

    const category = await prisma.category.findFirst();
    const product = await prisma.product.create({
      data: {
        name: "WAC Product", sku: "WAC-PROD-1", stockQuantity: 0,
        costPrice: 50.00, sellingPrice: 100.00, categoryId: category.id
      }
    });
    console.log(`Created product: ID ${product.id}, stockQuantity = 0, WAC = 0`);

    // 1. Purchase 10 units at Rs 100 each
    console.log("\nPurchase 1: 10 units @ Rs 100 each");
    const p1 = await purchaseModel.createPurchase({
      supplierId: supplier.id,
      items: [{ productId: product.id, quantity: 10, unitCost: 100.00 }],
      createdById: user.id
    });
    let pSnap = await prisma.product.findUnique({ where: { id: product.id } });
    console.log(`Product stockQuantity = ${pSnap.stockQuantity}, WAC = ${pSnap.weightedAvgCost}`);

    // 2. Purchase 10 units at Rs 40 each
    console.log("\nPurchase 2: 10 units @ Rs 40 each");
    const p2 = await purchaseModel.createPurchase({
      supplierId: supplier.id,
      items: [{ productId: product.id, quantity: 10, unitCost: 40.00 }],
      createdById: user.id
    });
    pSnap = await prisma.product.findUnique({ where: { id: product.id } });
    console.log(`Product stockQuantity = ${pSnap.stockQuantity}, WAC = ${pSnap.weightedAvgCost}`);
    // Expected WAC = (10 * 100 + 10 * 40) / 20 = 70. Matches? Let's see.

    // 3. Sell or adjust stock by 10 units (so stock is 10, WAC remains 70)
    // We adjust stock directly or simulate it. Let's do a manual adjustment of -10
    console.log("\nAdjusting stock: -10 units (e.g. sold or damaged)");
    await prisma.product.update({
      where: { id: product.id },
      data: { stockQuantity: 10 }
    });
    pSnap = await prisma.product.findUnique({ where: { id: product.id } });
    console.log(`Product stockQuantity = ${pSnap.stockQuantity}, WAC = ${pSnap.weightedAvgCost}`);

    // 4. Return 5 units from Purchase 1 (original cost = Rs 100 each)
    console.log("\nReturn 5 units from Purchase 1 (cost was Rs 100)...");
    const pr = await purchaseReturnModel.createPurchaseReturn({
      supplierId: supplier.id,
      purchaseId: p1.id,
      items: [{ productId: product.id, quantity: 5 }],
      createdById: user.id
    });
    
    pSnap = await prisma.product.findUnique({ where: { id: product.id } });
    console.log(`Product stockQuantity = ${pSnap.stockQuantity}, WAC = ${pSnap.weightedAvgCost}`);

    // Remaining 5 units: we purchased 10 at 100, returned 5. And we purchased 10 at 40. We sold 10.
    // Let's see what the WAC is. If WAC became 40, or 0, or something else.
    // Let's print it.

    // Cleanup
    console.log("\nCleaning up...");
    await prisma.purchaseReturnItem.deleteMany({});
    await prisma.purchaseReturn.deleteMany({});
    await prisma.purchaseItem.deleteMany({});
    await prisma.purchase.deleteMany({});
    await prisma.stockMovement.deleteMany({});
    await prisma.product.deleteMany({ where: { id: product.id } });
    await prisma.supplier.deleteMany({ where: { id: supplier.id } });

  } catch (e) {
    console.error("Error in WAC simulation:", e);
  }

  await prisma.$disconnect();
}

main();
