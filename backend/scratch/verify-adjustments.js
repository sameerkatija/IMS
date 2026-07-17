require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const prisma = require("../config/prisma");
const stockModel = require("../models/stock-model");

async function main() {
  console.log("=== START VERIFICATION ===");

  // Find a product
  const product = await prisma.product.findFirst();
  if (!product) {
    console.log("No product found to run adjustment. Please seed database.");
    return;
  }
  console.log(`Using product: ${product.name} (ID: ${product.id}, SKU: ${product.sku}, Cost: Rs.${product.costPrice}, Current Qty: ${product.stockQuantity})`);

  // Find a user
  const user = await prisma.user.findFirst();
  if (!user) {
    console.log("No user found. Please seed database.");
    return;
  }

  // Create a negative stock adjustment (e.g. -2 items lost)
  const lostQty = -2;
  console.log(`\nCreating adjustment: ${lostQty} pcs...`);
  
  const adj = await stockModel.createAdjustment({
    productId: product.id,
    quantity: lostQty,
    reason: "Damaged",
    description: "Lost during audit testing",
    createdById: user.id
  });

  console.log("Adjustment logged:", adj);

  // Check updated product stock
  const updatedProduct = await prisma.product.findUnique({
    where: { id: product.id }
  });
  console.log("New stock quantity:", updatedProduct.stockQuantity);

  // Verify created Expense
  const expectedExpenseAmount = Number(product.costPrice) * Math.abs(lostQty);
  console.log(`Expected expense amount: Rs.${expectedExpenseAmount}`);

  const latestExpense = await prisma.expense.findFirst({
    where: {
      description: {
        contains: `Inventory Adjustment (Loss): ${Math.abs(lostQty)} pcs of ${product.name}`
      }
    },
    include: {
      category: true
    },
    orderBy: {
      id: "desc"
    }
  });

  if (latestExpense) {
    console.log("\nSUCCESS: Expense logged successfully!");
    console.log("Expense ID:", latestExpense.id);
    console.log("Expense Category:", latestExpense.category.name);
    console.log("Expense Amount: Rs.", Number(latestExpense.amount));
    console.log("Expense Description:", latestExpense.description);
  } else {
    console.log("\nFAILED: Expense record was not found!");
  }

  console.log("=== END VERIFICATION ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
