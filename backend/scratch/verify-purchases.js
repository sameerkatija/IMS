// Load environment variables from the backend .env file
require("dotenv").config({ path: "c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/.env" });

const prisma = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/config/prisma");
const purchaseModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/purchase-model");
const purchaseReturnModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/purchase-return-model");

async function main() {
  console.log("=== Purchases & Returns Engine Verification ===");

  // 1. Get or create a user
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Verifier Admin",
        username: "verifier",
        password: "password123",
        role: "ADMIN"
      }
    });
  }
  const userId = user.id;

  // 2. Get or create a test supplier
  const supplierName = `Test Supplier-${Date.now()}`;
  const supplier = await prisma.supplier.create({
    data: {
      name: supplierName,
      phone: "1234567890",
      address: "123 Supplier Lane",
      balance: 0.00
    }
  });
  console.log(`Created supplier: ID = ${supplier.id}, balance = ${supplier.balance}`);

  // 3. Get or create a category and a product
  let category = await prisma.category.findFirst();
  if (!category) {
    category = await prisma.category.create({
      data: { name: "Verification Category" }
    });
  }
  
  const productSku = `TEST-PROD-${Date.now()}`;
  const product = await prisma.product.create({
    data: {
      name: "Verification Product",
      sku: productSku,
      categoryId: category.id,
      costPrice: 10.00,
      sellingPrice: 15.00,
      stockQuantity: 0
    }
  });
  console.log(`Created product: ID = ${product.id}, stockQuantity = ${product.stockQuantity}`);

  // --- Test 1: Record a Purchase (Buy 15 pieces @ 10 each, discount 5) ---
  console.log("\n--- Test 1: Recording Purchase ---");
  const purchase = await purchaseModel.createPurchase({
    supplierId: supplier.id,
    purchaseDate: new Date(),
    discount: 5.00,
    description: "Purchase description test",
    createdById: userId,
    items: [
      {
        productId: product.id,
        quantity: 15,
        unitCost: 10.00
      }
    ]
  });
  console.log(`Purchase recorded. ID = ${purchase.id}, DocNo = ${purchase.purchaseNo}`);
  console.log(`Subtotal = ${purchase.subtotal}, Discount = ${purchase.discount}, Total = ${purchase.total}`);

  // Verify stock updated (+15)
  const updatedProduct = await prisma.product.findUnique({ where: { id: product.id } });
  console.log(`Product stock quantity: ${updatedProduct.stockQuantity} (Expected: 15)`);
  if (updatedProduct.stockQuantity !== 15) {
    throw new Error(`Expected product stock to be 15, got ${updatedProduct.stockQuantity}`);
  }

  // Verify supplier balance updated (+145.00)
  const updatedSupplier = await prisma.supplier.findUnique({ where: { id: supplier.id } });
  console.log(`Supplier balance: ${updatedSupplier.balance} (Expected: 145.00)`);
  if (Number(updatedSupplier.balance) !== 145.00) {
    throw new Error(`Expected supplier balance to be 145.00, got ${updatedSupplier.balance}`);
  }

  // Verify StockMovement logged (IN, 15)
  const movements = await prisma.stockMovement.findMany({ where: { productId: product.id } });
  console.log(`Movements logged: ${movements.length} (Expected: 1)`);
  if (movements.length !== 1 || movements[0].type !== "IN" || movements[0].quantity !== 15) {
    throw new Error("Movement mismatch.");
  }

  // Verify SupplierLedger logged (credit 145.00, debit 0)
  const ledgerEntries = await prisma.supplierLedger.findMany({ where: { supplierId: supplier.id } });
  console.log(`Ledger entries logged: ${ledgerEntries.length} (Expected: 1)`);
  if (ledgerEntries.length !== 1 || Number(ledgerEntries[0].credit) !== 145.00 || Number(ledgerEntries[0].balance) !== 145.00) {
    throw new Error("Ledger mismatch.");
  }


  // --- Test 2: Record a Purchase Return (Return 5 pieces @ 10 each) ---
  console.log("\n--- Test 2: Recording Purchase Return ---");
  const pReturn = await purchaseReturnModel.createPurchaseReturn({
    supplierId: supplier.id,
    purchaseId: purchase.id,
    returnDate: new Date(),
    reason: "Damaged returns",
    createdById: userId,
    items: [
      {
        productId: product.id,
        quantity: 5,
        unitCost: 10.00
      }
    ]
  });
  console.log(`Purchase Return recorded. ID = ${pReturn.id}, DocNo = ${pReturn.returnNo}, Refund = ${pReturn.totalAmount}`);

  // Verify stock updated (-5, resulting in 10)
  const p1 = await prisma.product.findUnique({ where: { id: product.id } });
  console.log(`Product stock quantity: ${p1.stockQuantity} (Expected: 10)`);
  if (p1.stockQuantity !== 10) {
    throw new Error(`Expected stock to be 10, got ${p1.stockQuantity}`);
  }

  // Verify supplier balance updated (-50.00, resulting in 95.00)
  const s1 = await prisma.supplier.findUnique({ where: { id: supplier.id } });
  console.log(`Supplier balance: ${s1.balance} (Expected: 95.00)`);
  if (Number(s1.balance) !== 95.00) {
    throw new Error(`Expected supplier balance to be 95.00, got ${s1.balance}`);
  }

  // Verify StockMovement logged (OUT, 5)
  const allMovements = await prisma.stockMovement.findMany({ where: { productId: product.id }, orderBy: { createdAt: "desc" } });
  console.log(`Total movements logged: ${allMovements.length} (Expected: 2)`);
  if (allMovements[0].type !== "OUT" || allMovements[0].quantity !== 5) {
    throw new Error("Return stock movement mismatch.");
  }

  // Verify SupplierLedger logged (credit 0, debit 50.00)
  const allLedgers = await prisma.supplierLedger.findMany({ where: { supplierId: supplier.id }, orderBy: { createdAt: "desc" } });
  console.log(`Total ledger entries logged: ${allLedgers.length} (Expected: 2)`);
  if (Number(allLedgers[0].debit) !== 50.00 || Number(allLedgers[0].balance) !== 95.00) {
    throw new Error("Return ledger entry mismatch.");
  }


  // --- Test 3: Validate Return Quantity Limits (Attempt to return 11 more, remaining is 10) ---
  console.log("\n--- Test 3: Insufficient Returnable Quantity Validation ---");
  try {
    await purchaseReturnModel.createPurchaseReturn({
      supplierId: supplier.id,
      purchaseId: purchase.id,
      reason: "Greedy return",
      createdById: userId,
      items: [
        {
          productId: product.id,
          quantity: 11, // only 10 left to return! (15 bought - 5 returned)
          unitCost: 10.00
        }
      ]
    });
    throw new Error("Validation failed: Allowed returning more items than remaining!");
  } catch (err) {
    console.log(`Successfully caught expected error: "${err.message}" (Status Code: ${err.statusCode})`);
    if (err.statusCode !== 400) {
      throw new Error(`Expected status code 400, got ${err.statusCode}`);
    }
  }

  // Verify database rolled back and no changes were committed
  const finalStock = await prisma.product.findUnique({ where: { id: product.id } });
  const finalBalance = await prisma.supplier.findUnique({ where: { id: supplier.id } });
  console.log(`Product stock quantity remains: ${finalStock.stockQuantity} (Expected: 10)`);
  console.log(`Supplier balance remains: ${finalBalance.balance} (Expected: 95.00)`);
  if (finalStock.stockQuantity !== 10 || Number(finalBalance.balance) !== 95.00) {
    throw new Error("Transaction did not roll back correctly on validation error!");
  }


  // --- Cleaning up ---
  console.log("\n--- Cleaning up test data ---");
  await prisma.supplierLedger.deleteMany({ where: { supplierId: supplier.id } });
  await prisma.purchaseReturnItem.deleteMany({ where: { purchaseReturnId: pReturn.id } });
  await prisma.purchaseReturn.delete({ where: { id: pReturn.id } });
  await prisma.purchaseItem.deleteMany({ where: { purchaseId: purchase.id } });
  await prisma.purchase.delete({ where: { id: purchase.id } });
  await prisma.stockMovement.deleteMany({ where: { productId: product.id } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.supplier.delete({ where: { id: supplier.id } });
  console.log("Cleanup complete.");

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
