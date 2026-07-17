// Load environment variables from the backend .env file
require("dotenv").config({ path: "c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/.env" });

const prisma = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/config/prisma");
const invoiceModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/invoice-model");
const salesReturnModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/sales-return-model");
const paymentModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/payment-model");
const stockModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/stock-model");

async function main() {
  console.log("=== Sales, Returns, & Payments Verification ===");

  // 1. Get or create user
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Sales Verifier",
        username: "salesverifier",
        password: "password123",
        role: "ADMIN"
      }
    });
  }
  const userId = user.id;

  // 2. Create customer
  const customer = await prisma.customer.create({
    data: {
      name: `Test Customer-${Date.now()}`,
      phone: "1234567890",
      address: "123 Customer Lane",
      balance: 0.00
    }
  });
  console.log(`Created customer: ID = ${customer.id}, balance = ${customer.balance}`);

  // 3. Get or create Category and Product
  let category = await prisma.category.findFirst();
  if (!category) {
    category = await prisma.category.create({
      data: { name: "Sales Verification Category" }
    });
  }

  const productSku = `SALES-PROD-${Date.now()}`;
  const product = await prisma.product.create({
    data: {
      name: "Sales Product",
      sku: productSku,
      categoryId: category.id,
      costPrice: 8.00,
      sellingPrice: 12.00,
      stockQuantity: 50 // initial stock to prevent out of stock error
    }
  });
  console.log(`Created product: ID = ${product.id}, stockQuantity = ${product.stockQuantity}`);

  // Add initial stock movement log for this product so integrity verify works
  await prisma.stockMovement.create({
    data: {
      productId: product.id,
      type: "IN",
      quantity: 50,
      referenceType: "ADJUSTMENT",
      referenceId: 0,
      createdById: userId,
      description: "Initial Stock Seeding"
    }
  });

  // --- Test 1: Credit Invoice (Sell 15 pieces @ 12.00, discount 10.00, paid 30.00) ---
  console.log("\n--- Test 1: Recording Credit Invoice ---");
  const invoice = await invoiceModel.createInvoice({
    customerId: customer.id,
    salesmanId: null,
    saleType: "CREDIT",
    invoiceDate: new Date(),
    discount: 10.00,
    paidAmount: 30.00,
    description: "Credit sale test",
    createdById: userId,
    items: [
      {
        productId: product.id,
        quantity: 15,
        unitPrice: 12.00
      }
    ]
  });
  console.log(`Invoice recorded. ID = ${invoice.id}, DocNo = ${invoice.invoiceNo}`);
  console.log(`Subtotal = ${invoice.subtotal}, Discount = ${invoice.discount}, Total = ${invoice.total}`);
  console.log(`PaidAmount = ${invoice.paidAmount}, BalanceDue = ${invoice.balanceDue}, Status = ${invoice.status}`);

  // Verify stock updated (-15, resulting in 35)
  let p1 = await prisma.product.findUnique({ where: { id: product.id } });
  console.log(`Product stock quantity: ${p1.stockQuantity} (Expected: 35)`);
  if (p1.stockQuantity !== 35) {
    throw new Error(`Expected product stock to be 35, got ${p1.stockQuantity}`);
  }

  // Verify customer balance updated (+140.00, total total is 170, we paid 30)
  let c1 = await prisma.customer.findUnique({ where: { id: customer.id } });
  console.log(`Customer balance: ${c1.balance} (Expected: 140.00)`);
  if (Number(c1.balance) !== 140.00) {
    throw new Error(`Expected customer balance to be 140.00, got ${c1.balance}`);
  }

  // Verify StockMovement logged (OUT, 15)
  const sm1 = await prisma.stockMovement.findMany({ where: { productId: product.id, type: "OUT" } });
  console.log(`OUT movements logged: ${sm1.length} (Expected: 1)`);
  if (sm1.length !== 1 || sm1[0].quantity !== 15) {
    throw new Error("Outward movement mismatch.");
  }

  // Verify CustomerPayment logged (amount 30.00)
  const cp1 = await prisma.customerPayment.findMany({ where: { invoiceId: invoice.id } });
  console.log(`Invoice customer payments logged: ${cp1.length} (Expected: 1)`);
  if (cp1.length !== 1 || Number(cp1[0].amount) !== 30.00) {
    throw new Error("Invoice customer payment amount mismatch.");
  }

  // Verify CustomerLedger logged (debit 140.00, credit 0, balance 140.00)
  const cl1 = await prisma.customerLedger.findMany({ where: { customerId: customer.id } });
  console.log(`Ledger entries logged: ${cl1.length} (Expected: 1)`);
  if (cl1.length !== 1 || Number(cl1[0].debit) !== 140.00 || Number(cl1[0].balance) !== 140.00) {
    throw new Error("Customer ledger entry mismatch.");
  }


  // --- Test 2: Sales Return (Return 5 pieces @ 12.00) ---
  console.log("\n--- Test 2: Recording Sales Return ---");
  const sReturn = await salesReturnModel.createSalesReturn({
    customerId: customer.id,
    invoiceId: invoice.id,
    returnDate: new Date(),
    reason: "Wrong items",
    createdById: userId,
    items: [
      {
        productId: product.id,
        quantity: 5,
        unitPrice: 12.00
      }
    ]
  });
  console.log(`Sales Return recorded. ID = ${sReturn.id}, DocNo = ${sReturn.returnNo}, Refund = ${sReturn.totalAmount}`);

  // Verify stock updated (+5, resulting in 40)
  let p2 = await prisma.product.findUnique({ where: { id: product.id } });
  console.log(`Product stock quantity: ${p2.stockQuantity} (Expected: 40)`);
  if (p2.stockQuantity !== 40) {
    throw new Error(`Expected product stock to be 40, got ${p2.stockQuantity}`);
  }

  // Verify customer balance updated (-60.00, resulting in 80.00)
  let c2 = await prisma.customer.findUnique({ where: { id: customer.id } });
  console.log(`Customer balance: ${c2.balance} (Expected: 80.00)`);
  if (Number(c2.balance) !== 80.00) {
    throw new Error(`Expected customer balance to be 80.00, got ${c2.balance}`);
  }

  // Verify StockMovement logged (IN, 5)
  const sm2 = await prisma.stockMovement.findMany({ where: { productId: product.id, type: "IN" } });
  console.log(`IN movements logged: ${sm2.length} (Expected: 2, 1 seeding + 1 return)`);
  if (sm2.length !== 2) {
    throw new Error("Return stock movement mismatch.");
  }

  // Verify CustomerLedger logged (credit 60.00, balance 80.00)
  const cl2 = await prisma.customerLedger.findMany({ where: { customerId: customer.id }, orderBy: { createdAt: "desc" } });
  console.log(`Ledger entries logged: ${cl2.length} (Expected: 2)`);
  if (Number(cl2[0].credit) !== 60.00 || Number(cl2[0].balance) !== 80.00) {
    throw new Error("Return Customer ledger entry mismatch.");
  }


  // --- Test 3: Customer Payment (Pay 80.00 against invoice) ---
  console.log("\n--- Test 3: Recording Customer Payment of 80.00 ---");
  const payment = await paymentModel.recordCustomerPayment({
    customerId: customer.id,
    invoiceId: invoice.id,
    amount: 80.00,
    paymentDate: new Date(),
    description: "Final pay",
    createdById: userId
  });
  console.log(`Payment recorded. ID = ${payment.id}, Amount = ${payment.amount}`);

  // Verify Invoice details updated (paidAmount: 30 + 80 = 110, balanceDue: 170 - 110 = 60, status: PARTIALLY_PAID)
  const updatedInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id } });
  console.log(`Invoice stats - Paid: ${updatedInvoice.paidAmount}, Due: ${updatedInvoice.balanceDue}, Status: ${updatedInvoice.status}`);
  if (Number(updatedInvoice.paidAmount) !== 110.00 || Number(updatedInvoice.balanceDue) !== 60.00 || updatedInvoice.status !== "PARTIALLY_PAID") {
    throw new Error("Invoice update stats mismatch.");
  }

  // Verify customer balance updated (-80.00, resulting in 0.00)
  let c3 = await prisma.customer.findUnique({ where: { id: customer.id } });
  console.log(`Customer balance: ${c3.balance} (Expected: 0.00)`);
  if (Number(c3.balance) !== 0.00) {
    throw new Error(`Expected customer balance to be 0.00, got ${c3.balance}`);
  }


  // --- Test 4: Overpayment Checks ---
  console.log("\n--- Test 4: Overpayment Validation Check ---");
  try {
    // Attempting to pay another 70.00 against invoice which only has 60.00 due
    await paymentModel.recordCustomerPayment({
      customerId: customer.id,
      invoiceId: invoice.id,
      amount: 70.00,
      createdById: userId
    });
    throw new Error("Validation failed: Allowed customer to overpay the invoice balance due!");
  } catch (err) {
    console.log(`Successfully caught expected error: "${err.message}" (Status Code: ${err.statusCode})`);
    if (err.statusCode !== 400) {
      throw new Error(`Expected status 400, got ${err.statusCode}`);
    }
  }

  // Verify database rolled back and customer balance remains 0.00
  let c4 = await prisma.customer.findUnique({ where: { id: customer.id } });
  if (Number(c4.balance) !== 0.00) {
    throw new Error("Transaction did not roll back correctly on payment validation error!");
  }


  // --- Cleaning up ---
  console.log("\n--- Cleaning up test data ---");
  await prisma.customerLedger.deleteMany({ where: { customerId: customer.id } });
  await prisma.customerPayment.deleteMany({ where: { customerId: customer.id } });
  await prisma.salesReturnItem.deleteMany({ where: { salesReturnId: sReturn.id } });
  await prisma.salesReturn.delete({ where: { id: sReturn.id } });
  await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
  await prisma.invoice.delete({ where: { id: invoice.id } });
  await prisma.stockMovement.deleteMany({ where: { productId: product.id } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.customer.delete({ where: { id: customer.id } });
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
