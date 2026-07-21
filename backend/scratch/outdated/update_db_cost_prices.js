require("dotenv").config();
const prisma = require("../config/prisma");

async function main() {
  // PUR-000002 details
  const subtotal = 2291556;
  const consignmentDiscount = 776;
  const discountFactor = consignmentDiscount / subtotal;

  const items = [
    { productId: 6, unitCost: 800, rowDiscount: 0 },
    { productId: 3, unitCost: 1040, rowDiscount: 0 },
    { productId: 7, unitCost: 88, rowDiscount: 120 },
    { productId: 8, unitCost: 125, rowDiscount: 0 },
    { productId: 9, unitCost: 139, rowDiscount: 0 },
    { productId: 11, unitCost: 92, rowDiscount: 0 },
    { productId: 12, unitCost: 12, rowDiscount: 0 },
    { productId: 13, unitCost: 88, rowDiscount: 0 },
    { productId: 14, unitCost: 88, rowDiscount: 0 },
    { productId: 15, unitCost: 88, rowDiscount: 0 },
    { productId: 16, unitCost: 88, rowDiscount: 0 },
    { productId: 10, unitCost: 150, rowDiscount: 0 }
  ];

  console.log("Updating product cost prices...");
  for (const item of items) {
    const originalPrice = item.unitCost;
    // Calculate net cost: subtract row discount, then apply consignment discount factor
    const netAfterRowDiscount = originalPrice - (item.rowDiscount / (item.productId === 7 ? 240 : 1));
    const netUnitCost = netAfterRowDiscount * (1 - discountFactor);

    await prisma.product.update({
      where: { id: item.productId },
      data: { costPrice: netUnitCost }
    });
    console.log(`Updated Product ${item.productId}: ${originalPrice} -> ${netUnitCost}`);
  }

  // Verify total valuation
  const products = await prisma.product.findMany({
    where: { isActive: true }
  });

  let totalValuation = 0;
  for (const p of products) {
    totalValuation += p.stockQuantity * Number(p.costPrice);
  }

  console.log("-----------------------------------------");
  console.log("New Database Valuation:", totalValuation);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
