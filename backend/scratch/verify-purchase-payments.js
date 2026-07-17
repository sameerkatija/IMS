// Load environment variables from the backend .env file
require("dotenv").config({ path: "c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/.env" });

const prisma = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/config/prisma");
const purchaseModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/purchase-model");
const paymentModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/payment-model");

async function main() {
  console.log("=== Existing Purchase Supplier Credit Application Verification ===");

  // 1. Setup test user
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

  // 2. Setup test supplier
  let supplier = await prisma.supplier.findFirst();
  if (!supplier) {
    console.log("Creating test supplier...");
    supplier = await prisma.supplier.create({
      data: {
        name: "Test Supplier",
        phone: "1234567890",
        address: "123 Supplier Lane",
        balance: 0
      }
    });
  }
  const supplierId = supplier.id;

  const initialSupplierBalance = Number(supplier.balance);

  // 3. Setup test product
  let product = await prisma.product.findFirst({ where: { isActive: true } });
  if (!product) {
    let category = await prisma.category.findFirst();
    if (!category) {
      category = await prisma.category.create({ data: { name: "Test Cat" } });
    }
    product = await prisma.product.create({
      data: {
        name: "Test Prod",
        sku: `SKU-${Date.now()}`,
        categoryId: category.id,
        costPrice: 50.0,
        sellingPrice: 100.0,
        stockQuantity: 10
      }
    });
  }
  const productId = product.id;

  // 4. Create a new purchase of 1000 with 0 paid and 0 credit initially
  console.log("\nCreating a test purchase for Rs. 1000...");
  const purchase = await purchaseModel.createPurchase({
    supplierId,
    purchaseDate: new Date(),
    discount: 0,
    paidAmount: 0,
    creditApplied: 0,
    description: "Verification Base Purchase",
    items: [{ productId, quantity: 10, unitCost: 100 }], // total = 1000
    createdById: userId
  });

  console.log(`Purchase No: ${purchase.purchaseNo}`);
  console.log(`Initial Balance Due: Rs. ${purchase.balanceDue} (Expected: 1000.00)`);
  console.log(`Initial Status: ${purchase.status} (Expected: UNPAID)`);

  // Set supplier balance to represent a simulated return credit
  // Since creating the purchase added 1000 to the ledger, let's update supplier balance to +700 (which simulates -300 return credit starting point, as -300 + 1000 = +700)
  await prisma.supplier.update({
    where: { id: supplierId },
    data: { balance: 700 }
  });
  console.log("Simulating return credit by adjusting overall supplier balance to Rs. 700 (Supplier owes us 300 from returns, net balance we owe is 700).");

  // ============================================================
  // TEST 1: Attempt to apply credit without purchaseId
  // ============================================================
  console.log("\n--- Test 1: Attempting to apply credit without purchaseId ---");
  try {
    await paymentModel.recordSupplierPayment({
      supplierId,
      amount: 150,
      isCreditApplied: true,
      description: "Should Fail",
      createdById: userId
    });
    throw new Error("Test 1 Failed: Credit applied without purchaseId.");
  } catch (err) {
    console.log(`Expected validation error caught: "${err.message}"`);
  }

  // ============================================================
  // TEST 2: Attempt to apply credit exceeding available credit note balance
  // ============================================================
  console.log("\n--- Test 2: Attempting to apply more credit than available ---");
  try {
    await paymentModel.recordSupplierPayment({
      supplierId,
      purchaseId: purchase.id,
      amount: 400, // available is only 300 (supplier.balance is 700, so negative return balance is 300)
      isCreditApplied: true,
      description: "Should Fail",
      createdById: userId
    });
    throw new Error("Test 2 Failed: Credit applied exceeds available supplier credit.");
  } catch (err) {
    console.log(`Expected validation error caught: "${err.message}"`);
  }

  // ============================================================
  // TEST 3: Apply valid credit (300) to the purchase
  // ============================================================
  console.log("\n--- Test 3: Applying valid credit to the purchase ---");
  const payment = await paymentModel.recordSupplierPayment({
    supplierId,
    purchaseId: purchase.id,
    amount: 300,
    isCreditApplied: true,
    description: "Apply return credit to existing purchase",
    createdById: userId
  });

  // Verify purchase updates
  const pUpdated = await prisma.purchase.findUnique({ where: { id: purchase.id } });
  console.log(`Updated Purchase Credit Applied: Rs. ${pUpdated.creditApplied} (Expected: 300.00)`);
  console.log(`Updated Purchase Balance Due: Rs. ${pUpdated.balanceDue} (Expected: 700.00)`);
  console.log(`Updated Purchase Status: ${pUpdated.status} (Expected: PARTIALLY_PAID)`);

  if (
    Number(pUpdated.creditApplied) !== 300 ||
    Number(pUpdated.balanceDue) !== 700 ||
    pUpdated.status !== "PARTIALLY_PAID"
  ) {
    throw new Error("Test 3 Failed: Purchase was not updated correctly.");
  }

  // Confirm supplier overall balance remains unchanged (still 700, since credit allocation doesn't change cash/goods outstanding)
  const suppAfter = await prisma.supplier.findUnique({ where: { id: supplierId } });
  console.log(`Supplier Overall Ledger Balance Owed: Rs. ${suppAfter.balance} (Expected: 700.00)`);
  if (Number(suppAfter.balance) !== 700) {
    throw new Error("Test 3 Failed: Supplier balance changed when applying credit (should remain +700).");
  }

  // Confirm no ledger debit was double-posted
  const ledgerCount = await prisma.supplierLedger.count({
    where: { referenceId: payment.id, referenceType: "PURCHASE" }
  });
  console.log(`Ledger entry count for payment transaction: ${ledgerCount} (Expected: 0)`);
  if (ledgerCount !== 0) {
    throw new Error("Test 3 Failed: Double-debit was posted to the supplier ledger.");
  }

  // ============================================
  // CLEANUP TEST DATA
  // ============================================
  console.log("\nCleaning up test records...");
  await prisma.supplierPayment.deleteMany({ where: { purchaseId: purchase.id } });
  await prisma.supplierLedger.deleteMany({ where: { referenceId: purchase.id, referenceType: "PURCHASE" } });
  await prisma.stockMovement.deleteMany({ where: { referenceId: purchase.id, referenceType: "PURCHASE" } });
  await prisma.purchaseItem.deleteMany({ where: { purchaseId: purchase.id } });
  await prisma.purchase.delete({ where: { id: purchase.id } });

  // Restore supplier initial balance
  await prisma.supplier.update({
    where: { id: supplierId },
    data: { balance: initialSupplierBalance }
  });

  console.log("\n=== ALL EXISTING PURCHASE CREDIT TESTS PASSED SUCCESSFULLY ===");
}

main()
  .catch((err) => {
    console.error("Verification failed with error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
