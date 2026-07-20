require("dotenv").config();
const prisma = require("../config/prisma");

async function main() {
  console.log("Seeding master data...");

  // 1. Recreate default User (id: 1)
  const user = await prisma.user.upsert({
    where: { username: "test" },
    update: {},
    create: {
      id: 1,
      name: "Test Administrator",
      username: "test",
      email: "test@example.com",
      // Password is: admin123
      password: "$2b$10$J.Ez4GHDbX/fAt68ZYi2nuti/Dzlxk.WX2/g7qmEfkBPmzdJoUqi2",
      role: "ADMIN",
      isActive: true,
    },
  });
  console.log("User seeded:", user.username);

  // 2. Recreate Category (id: 1)
  const category = await prisma.category.upsert({
    where: { name: "Beverages" },
    update: {},
    create: {
      id: 1,
      name: "Beverages",
      isActive: true,
    },
  });
  console.log("Category seeded:", category.name);

  // 3. Recreate Products
  const productsData = [
    {
      id: 1,
      name: "Pepsi 1.5L",
      barcode: "1111111111",
      sku: "PEPSI1.5L",
      categoryId: 1,
      costPrice: 100.0,
      sellingPrice: 150.0,
      weightedAvgCost: 99.8276,
      stockQuantity: 0,
      lowStockLevel: 50,
      isActive: true,
    },
    {
      id: 2,
      name: "Lays Chips",
      barcode: "2222222222",
      sku: "LAYS",
      categoryId: 1,
      costPrice: 40.0,
      sellingPrice: 60.0,
      weightedAvgCost: 39.0,
      stockQuantity: 0,
      lowStockLevel: 100,
      isActive: true,
    },
    {
      id: 7,
      name: "Race Product",
      barcode: null,
      sku: "RACE-1",
      categoryId: 1,
      costPrice: 50.0,
      sellingPrice: 100.0,
      weightedAvgCost: 0,
      stockQuantity: 0,
      lowStockLevel: 0,
      isActive: true,
    },
  ];

  for (const p of productsData) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: p,
    });
  }
  console.log("Products seeded.");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
