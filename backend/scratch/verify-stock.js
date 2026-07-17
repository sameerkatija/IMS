// Load environment variables from the backend .env file
require("dotenv").config({ path: "c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/.env" });

const prisma = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/config/prisma");
const stockModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/stock-model");

async function main() {
  console.log("=== Stock Engine Verification ===");

  // 1. Get or create a test user (we need a user to attribute adjustments/movements to)
  let user = await prisma.user.findFirst();
  if (!user) {
    console.log("Creating test user...");
    user = await prisma.user.create({
      data: {
        name: "Test User",
        username: "testuser",
        password: "password123",
        role: "ADMIN"
      }
    });
  }
  const userId = user.id;
  console.log(`Using user: ${user.name} (ID: ${userId})`);

  // 2. Get or create a test category
  let category = await prisma.category.findFirst();
  if (!category) {
    console.log("Creating test category...");
    category = await prisma.category.create({
      data: { name: "Test Category" }
    });
  }
  const categoryId = category.id;

  // 3. Create a unique test product
  const testSku = `TEST-SKU-${Date.now()}`;
  console.log(`Creating test product with SKU: ${testSku}`);
  const product = await prisma.product.create({
    data: {
      name: "Test Product",
      sku: testSku,
      categoryId,
      costPrice: 10.0,
      sellingPrice: 15.0,
      stockQuantity: 0,
      lowStockLevel: 2
    }
  });
  const productId = product.id;
  console.log(`Product created successfully: ID = ${productId}, stockQuantity = ${product.stockQuantity}`);

  // Test 1: Positive Stock Adjustment (+10)
  console.log("\n--- Test 1: Positive Stock Adjustment (+10) ---");
  const adj1 = await stockModel.createAdjustment({
    productId,
    quantity: 10,
    reason: "Initial Count",
    description: "Initial count recount for verification",
    createdById: userId
  });
  console.log(`Adjustment row created: ID = ${adj1.id}, quantity = ${adj1.quantity}`);

  // Fetch product to verify stock
  let updatedProduct = await prisma.product.findUnique({ where: { id: productId } });
  console.log(`Product stock quantity after adjustment: ${updatedProduct.stockQuantity} (Expected: 10)`);
  if (updatedProduct.stockQuantity !== 10) {
    throw new Error(`Test 1 Failed: Expected stock 10, got ${updatedProduct.stockQuantity}`);
  }

  // Verify stock movement log
  let movements = await prisma.stockMovement.findMany({ where: { productId } });
  console.log(`Movements logged for product: ${movements.length} (Expected: 1)`);
  if (movements.length !== 1) {
    throw new Error(`Test 1 Failed: Expected 1 movement, got ${movements.length}`);
  }
  console.log(`Logged movement: type = ${movements[0].type}, quantity = ${movements[0].quantity}, refType = ${movements[0].referenceType}, refId = ${movements[0].referenceId}, description = ${movements[0].description}`);

  // Test 2: Negative Stock Adjustment (-3)
  console.log("\n--- Test 2: Negative Stock Adjustment (-3) ---");
  const adj2 = await stockModel.createAdjustment({
    productId,
    quantity: -3,
    reason: "Damaged",
    description: "Water damage during transport",
    createdById: userId
  });
  console.log(`Adjustment row created: ID = ${adj2.id}, quantity = ${adj2.quantity}`);

  updatedProduct = await prisma.product.findUnique({ where: { id: productId } });
  console.log(`Product stock quantity after adjustment: ${updatedProduct.stockQuantity} (Expected: 7)`);
  if (updatedProduct.stockQuantity !== 7) {
    throw new Error(`Test 2 Failed: Expected stock 7, got ${updatedProduct.stockQuantity}`);
  }

  movements = await prisma.stockMovement.findMany({ where: { productId }, orderBy: { createdAt: "asc" } });
  console.log(`Movements logged for product: ${movements.length} (Expected: 2)`);
  if (movements.length !== 2) {
    throw new Error(`Test 2 Failed: Expected 2 movements, got ${movements.length}`);
  }
  console.log(`Second movement: type = ${movements[1].type}, quantity = ${movements[1].quantity}, refType = ${movements[1].referenceType}, refId = ${movements[1].referenceId}, description = ${movements[1].description}`);

  // Test 3: Insufficient Stock Prevention (Adjust -10)
  console.log("\n--- Test 3: Insufficient Stock Prevention (Adjust -10) ---");
  try {
    await stockModel.createAdjustment({
      productId,
      quantity: -10,
      reason: "Expired",
      description: "Throwing away expired stock",
      createdById: userId
    });
    throw new Error("Test 3 Failed: Stock adjustment succeeded but should have failed due to insufficient stock.");
  } catch (err) {
    console.log(`Successfully caught expected error: "${err.message}" (Status Code: ${err.statusCode})`);
    if (err.statusCode !== 400) {
      throw new Error(`Test 3 Failed: Expected error status 400, got ${err.statusCode}`);
    }
  }

  // Verify stock remains unchanged (7)
  updatedProduct = await prisma.product.findUnique({ where: { id: productId } });
  console.log(`Product stock quantity after failed adjustment: ${updatedProduct.stockQuantity} (Expected: 7)`);
  if (updatedProduct.stockQuantity !== 7) {
    throw new Error(`Test 3 Failed: Stock quantity was modified to ${updatedProduct.stockQuantity}`);
  }

  // Verify no new stock movement or adjustment was committed (should still be 2 movements, 2 adjustments)
  const totalMovements = await prisma.stockMovement.count({ where: { productId } });
  const totalAdjustments = await prisma.stockAdjustment.count({ where: { productId } });
  console.log(`Total movements committed: ${totalMovements} (Expected: 2)`);
  console.log(`Total adjustments committed: ${totalAdjustments} (Expected: 2)`);
  if (totalMovements !== 2 || totalAdjustments !== 2) {
    throw new Error(`Test 3 Failed: Transaction did not roll back. Movements: ${totalMovements}, Adjustments: ${totalAdjustments}`);
  }

  // Test 4: Integrity Verification Helper
  console.log("\n--- Test 4: Integrity Verification Helper ---");
  const integrityResult = await stockModel.verifyIntegrity(productId);
  console.log("Integrity check result:", integrityResult);
  if (!integrityResult.inSync) {
    throw new Error("Test 4 Failed: Stock is not in sync with movements.");
  }

  // Clean up test data
  console.log("\n--- Cleaning up test data ---");
  await prisma.stockMovement.deleteMany({ where: { productId } });
  await prisma.stockAdjustment.deleteMany({ where: { productId } });
  await prisma.product.delete({ where: { id: productId } });
  console.log("Test product cleanup complete.");

  console.log("\n=== ALL TESTS PASSED SUCCESSFULLY ===");
}

main()
  .catch((err) => {
    console.error("\n*** VERIFICATION FAILED ***", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
