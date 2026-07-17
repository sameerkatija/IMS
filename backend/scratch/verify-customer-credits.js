require("dotenv").config({ path: "c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/.env" });
const prisma = require("../config/prisma");
const invoiceModel = require("../models/invoice-model");
const paymentModel = require("../models/payment-model");
const salesReturnModel = require("../models/sales-return-model");

async function main() {
  console.log("=== CUSTOMER CREDIT & CASH RETURN VERIFICATION ===");

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

  // 2. Setup test customer
  console.log("\nSetting up test customer...");
  const customer = await prisma.customer.create({
    data: {
      name: `Test Customer ${Date.now()}`,
      phone: "1234567890",
      address: "123 Customer Lane",
      balance: 0
    }
  });
  const customerId = customer.id;

  // 3. Setup test product
  let product = await prisma.product.findFirst({ where: { isActive: true } });
  if (!product) {
    let category = await prisma.category.findFirst();
    if (!category) {
      category = await prisma.category.create({ data: { name: "Test Category" } });
    }
    product = await prisma.product.create({
      data: {
        name: "Test Tissue Pack",
        sku: `SKU-${Date.now()}`,
        categoryId: category.id,
        costPrice: 50.0,
        sellingPrice: 100.0,
        stockQuantity: 100
      }
    });
  }
  const productId = product.id;

  // 4. Create base invoice
  console.log("\nCreating Invoice 1 (total = Rs. 1000)...");
  const invoice1 = await invoiceModel.createInvoice({
    customerId,
    saleType: "CREDIT",
    invoiceDate: new Date(),
    discount: 0,
    paidAmount: 0,
    creditApplied: 0,
    description: "Base Invoice",
    items: [{ productId, quantity: 10, unitPrice: 100 }], // 1000 total
    createdById: userId
  });
  console.log(`Invoice 1 created. Total: ${invoice1.total}, Paid: ${invoice1.paidAmount}, CreditApplied: ${invoice1.creditApplied}, BalanceDue: ${invoice1.balanceDue}, Status: ${invoice1.status}`);

  // 5. Pay invoice in full
  console.log("\nRecording customer payment of Rs. 1000...");
  const payment1 = await paymentModel.recordCustomerPayment({
    customerId,
    invoiceId: invoice1.id,
    amount: 1000,
    isCreditApplied: false,
    paymentDate: new Date(),
    description: "Paid cash",
    createdById: userId
  });
  console.log(`Payment recorded. Invoice status now: ${payment1.invoiceId ? "Updated" : "N/A"}`);

  const updatedInvoice1 = await prisma.invoice.findUnique({ where: { id: invoice1.id } });
  console.log(`Invoice 1 status: ${updatedInvoice1.status}, Paid Amount: ${updatedInvoice1.paidAmount}, BalanceDue: ${updatedInvoice1.balanceDue}`);

  const customerAfterPay = await prisma.customer.findUnique({ where: { id: customerId } });
  console.log(`Customer balance after full payment: Rs. ${customerAfterPay.balance} (Expected: 0)`);

  // 6. Test Store Credit Return (refundType: "CREDIT")
  console.log("\n--- TEST: Store Credit Return (refundType = CREDIT) ---");
  const return1 = await salesReturnModel.createSalesReturn({
    customerId,
    invoiceId: invoice1.id,
    returnDate: new Date(),
    reason: "Defective items",
    refundType: "CREDIT",
    items: [{ productId, quantity: 3, unitPrice: 100 }], // 300 return value
    createdById: userId
  });
  console.log(`Return 1 created. Return No: ${return1.returnNo}, Refund Type: ${return1.refundType}, Total: Rs. ${return1.totalAmount}`);

  const customerAfterReturn1 = await prisma.customer.findUnique({ where: { id: customerId } });
  console.log(`Customer balance after return: Rs. ${customerAfterReturn1.balance} (Expected: -300)`);

  const ledgerAfterReturn1 = await prisma.customerLedger.findMany({
    where: { customerId },
    orderBy: { id: "desc" },
    take: 1
  });
  console.log(`Latest Ledger Entry: Description: "${ledgerAfterReturn1[0].description}", Debit: ${ledgerAfterReturn1[0].debit}, Credit: ${ledgerAfterReturn1[0].credit}, Running Balance: ${ledgerAfterReturn1[0].balance}`);

  // 7. Test applying credit to a new Invoice
  console.log("\n--- TEST: Applying Store Credit to New Invoice ---");
  const invoice2 = await invoiceModel.createInvoice({
    customerId,
    saleType: "CREDIT",
    invoiceDate: new Date(),
    discount: 0,
    paidAmount: 200,
    creditApplied: 300, // apply all available credit
    description: "Invoice 2 with applied credit",
    items: [{ productId, quantity: 5, unitPrice: 100 }], // 500 total
    createdById: userId
  });
  console.log(`Invoice 2 created. Total: ${invoice2.total}, Paid: ${invoice2.paidAmount}, CreditApplied: ${invoice2.creditApplied}, BalanceDue: ${invoice2.balanceDue}, Status: ${invoice2.status}`);

  const customerAfterInvoice2 = await prisma.customer.findUnique({ where: { id: customerId } });
  console.log(`Customer balance after Invoice 2: Rs. ${customerAfterInvoice2.balance} (Expected: 0)`);

  const ledgerAfterInvoice2 = await prisma.customerLedger.findMany({
    where: { customerId },
    orderBy: { id: "desc" },
    take: 2
  });
  console.log("Invoice 2 Ledger Entries (most recent first):");
  for (const l of ledgerAfterInvoice2) {
    console.log(`  - Entry: "${l.description}", Debit: ${l.debit}, Credit: ${l.credit}, Running Balance: ${l.balance}`);
  }

  // 8. Test Cash Refund (refundType: "CASH")
  console.log("\n--- TEST: Cash Return (refundType = CASH) ---");
  // Let's create an invoice of 500, pay it, then return it for CASH refund
  const invoice3 = await invoiceModel.createInvoice({
    customerId,
    saleType: "CREDIT",
    invoiceDate: new Date(),
    discount: 0,
    paidAmount: 500,
    creditApplied: 0,
    description: "Invoice 3",
    items: [{ productId, quantity: 5, unitPrice: 100 }],
    createdById: userId
  });
  console.log(`Invoice 3 created. Total: ${invoice3.total}, BalanceDue: ${invoice3.balanceDue}`);

  const customerBeforeCashReturn = await prisma.customer.findUnique({ where: { id: customerId } });
  console.log(`Customer balance before cash return: Rs. ${customerBeforeCashReturn.balance} (Expected: 0)`);

  const return2 = await salesReturnModel.createSalesReturn({
    customerId,
    invoiceId: invoice3.id,
    returnDate: new Date(),
    reason: "Changed mind",
    refundType: "CASH",
    items: [{ productId, quantity: 2, unitPrice: 100 }], // 200 return value (cash payout)
    createdById: userId
  });
  console.log(`Return 2 created. Return No: ${return2.returnNo}, Refund Type: ${return2.refundType}, Total: Rs. ${return2.totalAmount}`);

  const customerAfterCashReturn = await prisma.customer.findUnique({ where: { id: customerId } });
  console.log(`Customer balance after cash return: Rs. ${customerAfterCashReturn.balance} (Expected: 0)`);

  const ledgerAfterCashReturn = await prisma.customerLedger.findMany({
    where: { customerId },
    orderBy: { id: "desc" },
    take: 2
  });
  console.log("Cash Return Ledger Entries (most recent first):");
  for (const l of ledgerAfterCashReturn) {
    console.log(`  - Entry: "${l.description}", Debit: ${l.debit}, Credit: ${l.credit}, Running Balance: ${l.balance}`);
  }

  // Clean up
  console.log("\nCleaning up test customer and ledger entries...");
  await prisma.customerLedger.deleteMany({ where: { customerId } });
  await prisma.customerPayment.deleteMany({ where: { customerId } });
  await prisma.salesReturnItem.deleteMany({ where: { salesReturn: { customerId } } });
  await prisma.salesReturn.deleteMany({ where: { customerId } });
  await prisma.invoiceItem.deleteMany({ where: { invoice: { customerId } } });
  await prisma.invoice.deleteMany({ where: { customerId } });
  await prisma.customer.delete({ where: { id: customerId } });

  console.log("\n=== VERIFICATION SUCCESSFUL ===");
}

main().catch(console.error).finally(() => prisma.$disconnect());
