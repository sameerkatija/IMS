require("../config/env");
const prisma = require("../config/prisma");
const fifoCostModel = require("../models/fifo-cost-model");

async function main() {
  console.log("=== Backfilling Initial FIFO Inventory Cost Layers ===");

  const products = await prisma.product.findMany({
    where: { stockQuantity: { gt: 0 } },
    include: {
      costLayers: true,
      purchaseItems: {
        orderBy: { id: "desc" },
        take: 5,
        include: { purchase: true }
      }
    }
  });

  console.log(`Found ${products.length} products with positive stockQuantity.`);

  for (const product of products) {
    const existingLayerSum = product.costLayers.reduce((sum, l) => sum + l.remainingQuantity, 0);
    const unlayeredQty = product.stockQuantity - existingLayerSum;

    if (unlayeredQty > 0) {
      // Use latest purchase net cost or fallback to product reference costPrice
      let unitCost = Number(product.costPrice || product.weightedAvgCost || 0);
      let purchaseId = null;
      let purchaseItemId = null;

      if (product.purchaseItems && product.purchaseItems.length > 0) {
        const latestPurchaseItem = product.purchaseItems[0];
        unitCost = Number(latestPurchaseItem.unitCost);
        purchaseId = latestPurchaseItem.purchaseId;
        purchaseItemId = latestPurchaseItem.id;
      }

      await fifoCostModel.createCostLayer({
        productId: product.id,
        purchaseId,
        purchaseItemId,
        quantity: unlayeredQty,
        unitCost,
        receivedDate: new Date(),
      });

      console.log(`✓ Product ${product.name} (ID: ${product.id}): created FIFO layer of ${unlayeredQty} pcs @ Rs. ${unitCost}`);
    } else {
      console.log(`- Product ${product.name} (ID: ${product.id}): already fully layered (${existingLayerSum}/${product.stockQuantity} pcs).`);
    }
  }

  const { totalValuation, layers } = await fifoCostModel.getInventoryValuation();
  console.log(`\n=== Total FIFO Inventory Valuation on Hand: Rs. ${totalValuation.toLocaleString()} across ${layers.length} active layers ===`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
