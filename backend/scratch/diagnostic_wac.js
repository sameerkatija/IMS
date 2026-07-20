require("dotenv").config();
const prisma = require("../config/prisma");

async function main() {
  console.log("=== ERP DIAGNOSTIC: Purchase / Return / WAC audit ===\n");

  // 1. All purchases with their net totals
  const purchases = await prisma.purchase.findMany({
    orderBy: { purchaseDate: "asc" },
    include: {
      items: {
        include: { product: { select: { id: true, name: true } } }
      },
      returns: {
        include: { items: true }
      }
    }
  });

  let grandTotalPurchased = 0;
  let grandTotalReturned  = 0;

  for (const p of purchases) {
    grandTotalPurchased += Number(p.total);
    const returnTotal = p.returns.reduce((s, r) => s + Number(r.totalAmount), 0);
    grandTotalReturned += returnTotal;

    console.log(`${p.purchaseNo}  subtotal=${p.subtotal}  disc=${p.discount}  total=${p.total}  balanceDue=${p.balanceDue}  status=${p.status}  returns=${returnTotal}`);
    for (const item of p.items) {
      const pctDisc = Number(p.discount) > 0 ? ((Number(p.subtotal) > 0) ? (item.quantity * Number(item.unitCost)) / Number(p.subtotal) * Number(p.discount) : 0) : 0;
      console.log(`  └ Product ${item.productId} (${item.product.name}): qty=${item.quantity}  unitCost=${item.unitCost}  totalCost=${item.totalCost}  headerDiscShare=${pctDisc.toFixed(4)}  sum=(qty*unitCost)=${item.quantity * Number(item.unitCost)}`);
    }
    if (p.returns.length) {
      for (const r of p.returns) {
        console.log(`  └ RETURN ${r.returnNo}: totalAmount=${r.totalAmount}`);
        for (const ri of r.items) {
          console.log(`    └ productId=${ri.productId}  qty=${ri.quantity}  unitCost=${ri.unitCost}  totalCost=${ri.totalCost}`);
        }
      }
    }
    console.log();
  }

  console.log(`Grand total PURCHASED (sum of purchase.total): Rs. ${grandTotalPurchased.toFixed(2)}`);
  console.log(`Grand total RETURNED  (sum of return amounts): Rs. ${grandTotalReturned.toFixed(2)}`);
  console.log(`Net investment (purchased - returned)         : Rs. ${(grandTotalPurchased - grandTotalReturned).toFixed(2)}`);

  // 2. Current inventory valuation using WAC
  console.log("\n--- CURRENT INVENTORY VALUATION (WAC) ---");
  const products = await prisma.product.findMany({
    where: { isActive: true, stockQuantity: { gt: 0 } },
    select: { id: true, name: true, stockQuantity: true, costPrice: true, weightedAvgCost: true, sellingPrice: true }
  });

  let totalWACValue = 0;
  let totalCostPriceValue = 0;
  for (const p of products) {
    const wacVal  = p.stockQuantity * Number(p.weightedAvgCost);
    const cpVal   = p.stockQuantity * Number(p.costPrice);
    totalWACValue += wacVal;
    totalCostPriceValue += cpVal;
    console.log(`Product ${p.id} (${p.name}): qty=${p.stockQuantity}  costPrice=${p.costPrice}  WAC=${p.weightedAvgCost}  val@WAC=${wacVal.toFixed(2)}  val@cost=${cpVal.toFixed(2)}`);
  }

  console.log(`\nTotal @ WAC       : Rs. ${totalWACValue.toFixed(2)}`);
  console.log(`Total @ costPrice : Rs. ${totalCostPriceValue.toFixed(2)}`);

  await prisma.$disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
