require("dotenv").config();
const prisma = require("../config/prisma");

/**
 * Backfill Script: Recompute Product.costPrice from purchase history.
 *
 * For each product, finds its most recent PurchaseItem and recomputes
 * the true net unit cost by:
 *   1. Taking the item-level discount into account (PurchaseItem.totalCost already stores this)
 *   2. Distributing the header-level purchase discount proportionally
 *
 * This corrects the Inventory Valuation report total investment figure.
 */
async function main() {
  console.log("=== BACKFILL: Recomputing Product.costPrice from purchase history ===\n");

  // Fetch all active products
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, costPrice: true, stockQuantity: true },
  });

  let updatedCount = 0;
  let skippedCount = 0;

  for (const product of products) {
    // Find the most recent PurchaseItem for this product (join to Purchase for discount)
    const latestPurchaseItem = await prisma.purchaseItem.findFirst({
      where: { productId: product.id },
      orderBy: { purchase: { purchaseDate: "desc" } },
      include: {
        purchase: {
          select: {
            id: true,
            purchaseNo: true,
            subtotal: true,
            discount: true,
          },
        },
      },
    });

    if (!latestPurchaseItem) {
      console.log(`  SKIP  Product ${product.id} (${product.name}): no purchase history`);
      skippedCount++;
      continue;
    }

    const purchase = latestPurchaseItem.purchase;
    const qty = latestPurchaseItem.quantity;

    // PurchaseItem.totalCost already has the item-level (row) discount applied.
    // We only need to additionally subtract the proportional share of the header discount.
    const itemSubtotal = latestPurchaseItem.quantity * Number(latestPurchaseItem.unitCost);
    const purchaseSubtotal = Number(purchase.subtotal);
    const headerDiscount = Number(purchase.discount);

    // Proportion of header discount that belongs to this line item
    let proportionalHeaderDiscount = 0;
    if (purchaseSubtotal > 0 && headerDiscount > 0) {
      proportionalHeaderDiscount = (itemSubtotal / purchaseSubtotal) * headerDiscount;
    }

    // Net total cost for this line = PurchaseItem.totalCost - proportional header discount
    const netItemTotalCost = Number(latestPurchaseItem.totalCost) - proportionalHeaderDiscount;
    const netUnitCost = Math.round((netItemTotalCost / qty) * 100) / 100;

    const oldCost = Number(product.costPrice);

    if (Math.abs(oldCost - netUnitCost) < 0.001) {
      console.log(`  OK    Product ${product.id} (${product.name}): already correct at ${oldCost}`);
      skippedCount++;
      continue;
    }

    await prisma.product.update({
      where: { id: product.id },
      data: { costPrice: netUnitCost },
    });

    console.log(
      `  FIXED Product ${product.id} (${product.name}): ${oldCost} → ${netUnitCost}` +
      `  [from ${purchase.purchaseNo}, header disc share: ${proportionalHeaderDiscount.toFixed(2)}]`
    );
    updatedCount++;
  }

  console.log(`\n--- Backfill complete: ${updatedCount} updated, ${skippedCount} already correct/skipped ---\n`);

  // Verify final valuation
  const allProducts = await prisma.product.findMany({
    where: { isActive: true },
    select: { stockQuantity: true, costPrice: true, sellingPrice: true },
  });

  let totalInvestment = 0;
  let totalRetailValue = 0;
  let totalUnits = 0;

  for (const p of allProducts) {
    totalUnits += p.stockQuantity;
    totalInvestment += p.stockQuantity * Number(p.costPrice);
    totalRetailValue += p.stockQuantity * Number(p.sellingPrice);
  }

  console.log("=== POST-BACKFILL INVENTORY VALUATION ===");
  console.log(`Total Stock Units    : ${totalUnits}`);
  console.log(`Total Investment     : Rs. ${totalInvestment.toFixed(2)}`);
  console.log(`Retail Value         : Rs. ${totalRetailValue.toFixed(2)}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
