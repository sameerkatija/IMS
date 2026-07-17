// Load environment variables from the backend .env file
require("dotenv").config({ path: "c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/.env" });

const prisma = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/config/prisma");
const targetModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/sales-target-model");
const expenseModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/expense-model");
const reportModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/report-model");
const invoiceModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/invoice-model");
const salesReturnModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/sales-return-model");

async function main() {
  console.log("=== Reports & Dashboard Aggregation Verification ===");

  // 1. Get or create user
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: "Report Verifier",
        username: "reportverifier",
        password: "password123",
        role: "ADMIN"
      }
    });
  }
  const userId = user.id;

  // 2. Create a Salesman
  const salesman = await prisma.salesman.create({
    data: {
      name: `Test Salesman-${Date.now()}`,
      phone: "1112223333",
      isActive: true
    }
  });
  console.log(`Created salesman: ID = ${salesman.id}, Name = ${salesman.name}`);

  // 3. Set Monthly Target (e.g. 500.0 for current month)
  const now = new Date();
  const currentMonthStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  console.log(`Setting target for month: ${currentMonthStr}`);
  const target = await targetModel.setTarget(salesman.id, {
    month: currentMonthStr,
    targetAmount: 500.00,
    description: "Monthly goal",
    createdById: userId
  });
  console.log(`Target set successfully: ID = ${target.id}, Amount = ${target.targetAmount}`);

  // 4. Create customer and product to record sales
  let category = await prisma.category.findFirst();
  if (!category) {
    category = await prisma.category.create({
      data: { name: "Reporting Category" }
    });
  }

  const product = await prisma.product.create({
    data: {
      name: "Report Product",
      sku: `REP-PROD-${Date.now()}`,
      categoryId: category.id,
      costPrice: 50.00,
      sellingPrice: 100.00,
      stockQuantity: 100
    }
  });

  const customer = await prisma.customer.create({
    data: {
      name: `Report Customer-${Date.now()}`,
      balance: 0.00
    }
  });

  // Seed stock movement
  await prisma.stockMovement.create({
    data: {
      productId: product.id,
      type: "IN",
      quantity: 100,
      referenceType: "ADJUSTMENT",
      referenceId: 0,
      createdById: userId,
      description: "Reporting Seeding"
    }
  });

  // Fetch initial dashboard metrics
  const initialMetrics = await reportModel.getDashboardMetrics();

  // 5. Create Invoices attributed to Salesman (total 300.0)
  console.log("\nCreating attributed invoices...");
  const invoice1 = await invoiceModel.createInvoice({
    customerId: customer.id,
    salesmanId: salesman.id,
    saleType: "CREDIT",
    invoiceDate: new Date(),
    discount: 0,
    paidAmount: 100.00, // 200.00 credit
    description: "First sale",
    createdById: userId,
    items: [
      {
        productId: product.id,
        quantity: 3,
        unitPrice: 100.00 // Subtotal 300.00
      }
    ]
  });

  // 6. Create Sales Return linked to invoice (refund 100.00)
  console.log("Creating sales return...");
  const sReturn = await salesReturnModel.createSalesReturn({
    customerId: customer.id,
    invoiceId: invoice1.id,
    returnDate: new Date(),
    reason: "Damaged item returned",
    createdById: userId,
    items: [
      {
        productId: product.id,
        quantity: 1,
        unitPrice: 100.00
      }
    ]
  });

  // 7. Check Target Achievement (Gross = 300, Returns = 100, Net = 200, Target = 500, Achieved = 40%)
  console.log("\n--- Test 1: Calculating Target Achievement ---");
  const achievement = await targetModel.getAchievement(salesman.id, currentMonthStr);
  console.log("Achievement metrics calculated:", achievement);
  if (achievement.grossSales !== 300 || achievement.returns !== 100 || achievement.actualSales !== 200 || achievement.achievedPercent !== 40) {
    throw new Error("Achievement calculation metrics mismatch!");
  }

  // 8. Log Business Expenses
  console.log("\n--- Test 2: Logging Expense ---");
  let expenseCategory = await prisma.expenseCategory.findFirst();
  if (!expenseCategory) {
    expenseCategory = await prisma.expenseCategory.create({
      data: { name: "Office supplies" }
    });
  }
  const expense = await expenseModel.createExpense({
    categoryId: expenseCategory.id,
    amount: 50.00,
    expenseDate: new Date(),
    description: "Stationery items",
    createdById: userId
  });
  console.log(`Expense logged. ID = ${expense.id}, Amount = ${expense.amount}, Category = ${expense.category.name}`);

  // 9. Fetch Dashboard Metrics
  console.log("\n--- Test 3: Dashboard Metrics Aggregation ---");
  const metrics = await reportModel.getDashboardMetrics();
  console.log("Dashboard metrics snapshot:", metrics);
  
  // Verify that new expense of 50 is added to monthExpenses
  const expenseDiff = metrics.monthExpenses - initialMetrics.monthExpenses;
  console.log(`Expense difference before vs after: ${expenseDiff} (Expected: 50.00)`);
  if (expenseDiff !== 50.00) {
    throw new Error(`Expected expense diff to be 50.00, got ${expenseDiff}`);
  }

  // Verify that net profit difference matches the new transaction:
  // Gross profit from invoices: +150.00 (3 pieces * 50 profit/piece)
  // Expenses: -50.00
  // Net profit difference should be: +150.00 - 50.00 = +100.00
  const netProfitDiff = metrics.monthNetProfit - initialMetrics.monthNetProfit;
  console.log(`Net Profit difference before vs after: ${netProfitDiff} (Expected: 100.00)`);
  if (netProfitDiff !== 100.00) {
    throw new Error(`Expected net profit diff to be 100.00, got ${netProfitDiff}`);
  }

  // 10. Stock Report Valuations
  console.log("\n--- Test 4: Stock Valuations ---");
  const stockReport = await reportModel.currentStockReport();
  console.log(`Total Valuations - At Cost: ${stockReport.totalValueAtCost}, At Selling: ${stockReport.totalValueAtSellingPrice}`);

  // 11. Customer Aging Report Buckets
  console.log("\n--- Test 5: Receivables aging Buckets ---");
  const agingReport = await reportModel.customerLedgerReport();
  console.log("Aging Report entries:", JSON.stringify(agingReport, null, 2));

  // Clean up
  console.log("\n--- Cleaning up test data ---");
  await prisma.expense.delete({ where: { id: expense.id } });
  await prisma.salesTarget.delete({ where: { id: target.id } });
  await prisma.customerLedger.deleteMany({ where: { customerId: customer.id } });
  await prisma.customerPayment.deleteMany({ where: { customerId: customer.id } });
  await prisma.salesReturnItem.deleteMany({ where: { salesReturnId: sReturn.id } });
  await prisma.salesReturn.delete({ where: { id: sReturn.id } });
  await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice1.id } });
  await prisma.invoice.delete({ where: { id: invoice1.id } });
  await prisma.stockMovement.deleteMany({ where: { productId: product.id } });
  await prisma.product.delete({ where: { id: product.id } });
  await prisma.customer.delete({ where: { id: customer.id } });
  await prisma.salesman.delete({ where: { id: salesman.id } });
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
