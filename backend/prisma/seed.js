require("dotenv").config();
const prisma = require("../config/prisma");
const { seedGLAccounts } = require("../config/seed-gl-accounts");

async function main() {
  console.log("Seeding master data...");

  // 0. Seed Chart of Accounts (GL Accounts)
  await seedGLAccounts(prisma);
  console.log("GL Accounts seeded.");

  // 1. Recreate default User (id: 1)
  const user = await prisma.user.upsert({
    where: { username: "test" },
    update: {},
    create: {
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

  // 2. Recreate Category (Beverages)
  const category = await prisma.category.upsert({
    where: { name: "Beverages" },
    update: {},
    create: {
      name: "Beverages",
      isActive: true,
    },
  });
  console.log("Category seeded:", category.name);

  // 3. Recreate Products
  const productsData = [
    {
      name: "Pepsi 1.5L",
      barcode: "1111111111",
      sku: "PEPSI1.5L",
      categoryId: category.id,
      costPrice: 100.0,
      sellingPrice: 150.0,
      weightedAvgCost: 99.8276,
      stockQuantity: 0,
      lowStockLevel: 50,
      isActive: true,
    },
    {
      name: "Lays Chips",
      barcode: "2222222222",
      sku: "LAYS",
      categoryId: category.id,
      costPrice: 40.0,
      sellingPrice: 60.0,
      weightedAvgCost: 39.0,
      stockQuantity: 0,
      lowStockLevel: 100,
      isActive: true,
    },
    {
      name: "Race Product",
      barcode: null,
      sku: "RACE-1",
      categoryId: category.id,
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
      where: { sku: p.sku },
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
