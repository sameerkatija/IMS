require("../config/env");
const prisma = require("../config/prisma");

async function syncSequences() {
  const tables = ["Product", "Customer", "Supplier", "User", "Category", "Invoice", "Purchase", "SalesReturn", "PurchaseReturn", "CustomerPayment", "SupplierPayment"];
  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(`
        SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), coalesce(max(id), 0) + 1, false) FROM "${table}";
      `);
      console.log(`Synced sequence for table: ${table}`);
    } catch (err) {
      console.error(`Failed to sync sequence for table ${table}:`, err.message);
    }
  }
}

syncSequences().then(() => prisma.$disconnect());
