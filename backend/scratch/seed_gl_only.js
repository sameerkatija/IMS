require("dotenv").config();
const prisma = require("../config/prisma");
const { seedGLAccounts } = require("../config/seed-gl-accounts");

async function run() {
  console.log("Seeding standard Chart of Accounts (GLAccount)...");
  await seedGLAccounts(prisma);
  console.log("SUCCESS: GL accounts seeded successfully!");
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error("Error seeding GL accounts:", err);
  process.exit(1);
});
