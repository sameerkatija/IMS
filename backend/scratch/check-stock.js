require("dotenv").config({ path: "c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/.env" });
const prisma = require("../config/prisma");

async function main() {
  console.log("=== RECENT STOCK MOVEMENTS ===");
  const movements = await prisma.stockMovement.findMany({
    take: 10,
    orderBy: { id: "desc" },
    include: { product: true }
  });

  for (const m of movements) {
    console.log(`ID: ${m.id}, Product: ${m.product.name} (ID: ${m.productId}), Type: ${m.type}, Qty: ${m.quantity}, RefType: ${m.referenceType}, RefId: ${m.referenceId}, Desc: ${m.description}, CreatedAt: ${m.createdAt}`);
  }

  console.log("\n=== RECENT PRODUCTS ===");
  const products = await prisma.product.findMany({
    take: 10,
    orderBy: { id: "desc" }
  });
  for (const p of products) {
    console.log(`ID: ${p.id}, Name: ${p.name}, StockQuantity: ${p.stockQuantity}, Cost: ${p.costPrice}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
