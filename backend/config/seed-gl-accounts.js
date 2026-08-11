const prisma = require("./prisma");

const GL_ACCOUNT_DEFINITIONS = [
  { code: "1000", name: "Cash / Bank", type: "ASSET" },
  { code: "1100", name: "Accounts Receivable", type: "ASSET" },
  { code: "1300", name: "Inventory Asset", type: "ASSET" },
  { code: "1400", name: "Vendor Advances", type: "ASSET" },
  { code: "2000", name: "Accounts Payable", type: "LIABILITY" },
  { code: "2100", name: "Customer Deposits / Advances", type: "LIABILITY" },
  { code: "4000", name: "Sales Revenue", type: "INCOME" },
  { code: "4100", name: "Sales Returns", type: "CONTRA" },
  { code: "5000", name: "Cost of Goods Sold", type: "EXPENSE" },
  { code: "5100", name: "Purchase Return Variance", type: "EXPENSE" },
  { code: "5200", name: "Inventory Shrinkage / Write-down", type: "EXPENSE" },
  { code: "6000", name: "Operating Expenses", type: "EXPENSE" },
  { code: "6100", name: "Bad Debt Expense", type: "EXPENSE" },
];

/**
 * Ensures all foundational Chart of Accounts GL rows exist in the database.
 */
async function seedGLAccounts(client = prisma) {
  for (const acc of GL_ACCOUNT_DEFINITIONS) {
    await client.gLAccount.upsert({
      where: { code: acc.code },
      update: { name: acc.name, type: acc.type },
      create: { code: acc.code, name: acc.name, type: acc.type },
    });
  }
}

module.exports = { seedGLAccounts, GL_ACCOUNT_DEFINITIONS };
