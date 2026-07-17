require("dotenv").config({ path: "c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/.env" });
const prisma = require("../config/prisma");

async function main() {
  console.log("=== ALL PURCHASES ===");
  const purchases = await prisma.purchase.findMany({
    orderBy: { id: "desc" },
    include: {
      items: { include: { product: true } },
      returns: { include: { items: true } }
    }
  });

  for (const p of purchases) {
    console.log(`ID: ${p.id}, No: ${p.purchaseNo}, Total: Rs. ${p.total}, Paid: Rs. ${p.paidAmount}, CreditApplied: Rs. ${p.creditApplied}, BalanceDue: Rs. ${p.balanceDue}, Status: ${p.status}`);
    for (const item of p.items) {
      console.log(`  - Item Product: ${item.product.name} (ID: ${item.productId}), Qty: ${item.quantity}, UnitCost: Rs. ${item.unitCost}, TotalCost: Rs. ${item.totalCost}`);
    }
    for (const ret of p.returns) {
      console.log(`  - Return ID: ${ret.id}, ReturnNo: ${ret.returnNo}, TotalAmount: Rs. ${ret.totalAmount}`);
      for (const rItem of ret.items) {
        console.log(`    - Return Item Product ID: ${rItem.productId}, Qty: ${rItem.quantity}, UnitCost: Rs. ${rItem.unitCost}`);
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
