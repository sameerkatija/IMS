require("dotenv").config();
const prisma = require("../config/prisma");

/**
 * WAC Backfill v2 — Fixed.
 *
 * KEY FIX: PurchaseItem.totalCost already stores the final net cost
 * (item subtotal − item discount − proportional header discount), because
 * purchase-model.js computes and stores it that way at creation time.
 * Previous version double-deducted by subtracting the header discount AGAIN.
 *
 * Correct formula:
 *   netUnitCost = PurchaseItem.totalCost / PurchaseItem.quantity
 *
 * WAC is then built by replaying all purchase events in chronological order.
 *
 * ALSO: supplier returns are applied after each purchase batch to correctly
 * un-blend the WAC for returned units.
 */
async function main() {
  console.log("=== WAC BACKFILL v2 (fixed — no double deduction) ===\n");

  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, costPrice: true },
  });

  let updated = 0;
  let fallback = 0;

  for (const product of products) {
    // Fetch all purchase items for this product in chronological order (oldest first)
    const purchaseItems = await prisma.purchaseItem.findMany({
      where: { productId: product.id },
      orderBy: { purchase: { purchaseDate: "asc" } },
      include: {
        purchase: {
          select: {
            id: true,
            purchaseNo: true,
            purchaseDate: true,
          },
        },
      },
    });

    if (purchaseItems.length === 0) {
      // No purchase history — fallback to costPrice
      await prisma.product.update({
        where: { id: product.id },
        data: { weightedAvgCost: product.costPrice },
      });
      console.log(`  FALLBACK  Product ${product.id} (${product.name}): no history → WAC=${Number(product.costPrice)}`);
      fallback++;
      continue;
    }

    // Fetch all purchase returns for this product in chronological order
    const returnItems = await prisma.purchaseReturnItem.findMany({
      where: { productId: product.id },
      orderBy: { purchaseReturn: { returnDate: "asc" } },
      include: {
        purchaseReturn: {
          select: { returnDate: true, purchaseId: true },
        },
      },
    });

    // Build a merged timeline of purchase IN events and return OUT events
    const events = [];

    for (const pi of purchaseItems) {
      // PurchaseItem.totalCost is already the final net cost — no further adjustment needed
      const netUnitCost = pi.quantity > 0 ? Number(pi.totalCost) / pi.quantity : 0;
      events.push({
        date: pi.purchase.purchaseDate,
        type: "IN",
        qty: pi.quantity,
        netUnitCost,
        label: pi.purchase.purchaseNo,
      });
    }

    for (const ri of returnItems) {
      // PurchaseReturnItem.unitCost is the net unit cost stored at return time
      events.push({
        date: ri.purchaseReturn.returnDate,
        type: "OUT",
        qty: ri.quantity,
        netUnitCost: Number(ri.unitCost),
        label: `return of purchaseId=${ri.purchaseReturn.purchaseId}`,
      });
    }

    // Sort by date ascending (purchases then returns in time order)
    events.sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningQty = 0;
    let runningWAC = 0;

    for (const ev of events) {
      if (ev.type === "IN") {
        // Blend new units into WAC
        const totalQty = runningQty + ev.qty;
        runningWAC =
          totalQty > 0
            ? (runningQty * runningWAC + ev.qty * ev.netUnitCost) / totalQty
            : ev.netUnitCost;
        runningQty = totalQty;
      } else {
        // OUT: reverse the returned units from the WAC pool
        // Formula: newWAC = (currentPool − returnedCost) / remainingQty
        // Pool value = runningQty * runningWAC
        // Returned cost = returnedQty * returnUnitCost
        const remainingQty = runningQty - ev.qty;
        if (remainingQty <= 0) {
          runningWAC = 0;
          runningQty = 0;
        } else {
          const poolValue = runningQty * runningWAC;
          const removedValue = ev.qty * ev.netUnitCost;
          runningWAC = Math.max(0, (poolValue - removedValue) / remainingQty);
          runningQty = remainingQty;
        }
      }
    }

    const finalWAC = Math.round(runningWAC * 10000) / 10000;

    await prisma.product.update({
      where: { id: product.id },
      data: { weightedAvgCost: finalWAC },
    });

    const inCount  = events.filter(e => e.type === "IN").length;
    const outCount = events.filter(e => e.type === "OUT").length;
    console.log(
      `  DONE  Product ${product.id} (${product.name}): WAC=${finalWAC}  finalQty=${runningQty}  [${inCount} purchase(s), ${outCount} return(s)]`
    );
    updated++;
  }

  console.log(`\n--- WAC Backfill v2 complete: ${updated} computed, ${fallback} fallback ---\n`);

  // Final valuation check
  const allProducts = await prisma.product.findMany({
    where: { isActive: true },
    select: { stockQuantity: true, weightedAvgCost: true, sellingPrice: true },
  });

  let totalUnits = 0;
  let totalInvestment = 0;
  let totalRetail = 0;

  for (const p of allProducts) {
    totalUnits += p.stockQuantity;
    totalInvestment += p.stockQuantity * Number(p.weightedAvgCost);
    totalRetail += p.stockQuantity * Number(p.sellingPrice);
  }

  console.log("=== INVENTORY VALUATION (WAC v2) ===");
  console.log(`Total Stock Units    : ${totalUnits}`);
  console.log(`Total Investment     : Rs. ${totalInvestment.toFixed(2)}`);
  console.log(`Retail Value         : Rs. ${totalRetail.toFixed(2)}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("WAC backfill v2 failed:", err);
  process.exit(1);
});
