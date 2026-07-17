// Load environment variables from the backend .env file
require("dotenv").config({ path: "c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/.env" });

const prisma = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/config/prisma");
const userModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/user-model");
const targetModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/sales-target-model");
const expenseModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/expense-model");
const purchaseModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/purchase-model");
const purchaseReturnModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/purchase-return-model");
const invoiceModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/invoice-model");
const salesReturnModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/sales-return-model");
const paymentModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/payment-model");

async function main() {
  console.log("=== Purging and Seeding Database with Large Dummy Dataset ===");

  // 1. Purge all tables in order of foreign key dependency
  console.log("Cleaning up database tables...");
  await prisma.salesReturnItem.deleteMany();
  await prisma.salesReturn.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.customerPayment.deleteMany();
  await prisma.customerLedger.deleteMany();
  await prisma.customer.deleteMany();
  
  await prisma.purchaseReturnItem.deleteMany();
  await prisma.purchaseReturn.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.supplierPayment.deleteMany();
  await prisma.supplierLedger.deleteMany();
  await prisma.supplier.deleteMany();

  await prisma.stockMovement.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  
  await prisma.expense.deleteMany();
  await prisma.expenseCategory.deleteMany();
  
  await prisma.salesTarget.deleteMany();
  await prisma.salesman.deleteMany();
  await prisma.user.deleteMany();
  
  console.log("Database purged successfully.");

  // 2. Seed Users
  console.log("Creating users...");
  const adminUser = await userModel.createUser({
    name: "Sameer Katija",
    username: "sameer",
    email: "sameerkatija@gmail.com",
    password: "password123",
    role: "ADMIN"
  });
  const staffUser = await userModel.createUser({
    name: "Staff Member",
    username: "staff",
    email: "staff@example.com",
    password: "password123",
    role: "STAFF"
  });
  const userId = adminUser.id;
  console.log(`Admin user: sameer / password123 (ID: ${userId})`);
  console.log(`Staff user: staff / password123 (ID: ${staffUser.id})`);

  // 3. Seed Product Categories
  console.log("Seeding categories...");
  const catDiapers = await prisma.category.create({ data: { name: "Diapers" } });
  const catTissues = await prisma.category.create({ data: { name: "Tissues" } });
  const catWipes = await prisma.category.create({ data: { name: "Wipes" } });
  const catSoap = await prisma.category.create({ data: { name: "Soap" } });

  // 4. Seed Products (Stock starts at 0, updated via purchases)
  console.log("Seeding products...");
  const products = [
    { name: "Pampers Size 3", sku: "PAM-SZ3", categoryId: catDiapers.id, costPrice: 1000, sellingPrice: 1200, lowStockLevel: 20 },
    { name: "Pampers Size 4", sku: "PAM-SZ4", categoryId: catDiapers.id, costPrice: 1100, sellingPrice: 1300, lowStockLevel: 20 },
    { name: "Rose Petal Tissue Pack", sku: "RP-TISSUE", categoryId: catTissues.id, costPrice: 150, sellingPrice: 200, lowStockLevel: 50 },
    { name: "Soft Box Tissue", sku: "SOFT-TISS", categoryId: catTissues.id, costPrice: 200, sellingPrice: 250, lowStockLevel: 40 },
    { name: "Johnsons Baby Wipes 80s", sku: "JB-WIPES80", categoryId: catWipes.id, costPrice: 300, sellingPrice: 380, lowStockLevel: 30 },
    { name: "Dettol Soap Bar", sku: "DET-SOAP", categoryId: catSoap.id, costPrice: 80, sellingPrice: 100, lowStockLevel: 100 },
    { name: "Lux Soap Bar", sku: "LUX-SOAP", categoryId: catSoap.id, costPrice: 70, sellingPrice: 90, lowStockLevel: 100 }
  ];

  const dbProducts = {};
  for (const p of products) {
    const created = await prisma.product.create({
      data: {
        name: p.name,
        sku: p.sku,
        categoryId: p.categoryId,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        lowStockLevel: p.lowStockLevel,
        stockQuantity: 0,
        isActive: true
      }
    });
    dbProducts[p.sku] = created;
  }
  console.log(`Seeded ${Object.keys(dbProducts).length} products.`);

  // 5. Seed Customers
  console.log("Seeding customers...");
  const custSuper = await prisma.customer.create({ data: { name: "Super Mart", phone: "03001234567", balance: 0.00 } });
  const custGeneral = await prisma.customer.create({ data: { name: "General Store", phone: "03337654321", balance: 0.00 } });
  const custCity = await prisma.customer.create({ data: { name: "City Wholesale", phone: "03219988776", balance: 0.00 } });
  const custCorner = await prisma.customer.create({ data: { name: "Corner Shop", phone: "03454433221", balance: 0.00 } });
  const custWalkIn = await prisma.customer.create({ data: { name: "Walk-in Cash Customer", balance: 0.00 } });

  // 6. Seed Suppliers
  console.log("Seeding suppliers...");
  const supPG = await prisma.supplier.create({ data: { name: "P&G Distributor", phone: "03121122334", balance: 0.00 } });
  const supRP = await prisma.supplier.create({ data: { name: "Rose Petal Corp", phone: "03225566778", balance: 0.00 } });
  const supUnilever = await prisma.supplier.create({ data: { name: "Unilever Pakistan", phone: "03348899001", balance: 0.00 } });
  const supLocal = await prisma.supplier.create({ data: { name: "Local Soap Supplier", balance: 0.00 } });

  // 7. Seed Salesmen
  console.log("Seeding salesmen...");
  const smSameer = await prisma.salesman.create({ data: { name: "Sameer Katija", phone: "03009999999", isActive: true } });
  const smJohn = await prisma.salesman.create({ data: { name: "John Doe", phone: "03112223334", isActive: true } });
  const smBob = await prisma.salesman.create({ data: { name: "Bob Smith", isActive: true } });

  // 8. Seed Expense Categories
  console.log("Seeding expense categories...");
  const expRent = await prisma.expenseCategory.create({ data: { name: "Office Rent" } });
  const expUtilities = await prisma.expenseCategory.create({ data: { name: "Electricity Bills" } });
  const expWages = await prisma.expenseCategory.create({ data: { name: "Staff Salaries" } });
  const expTransport = await prisma.expenseCategory.create({ data: { name: "Fuel & Van Transport" } });

  // 9. Record Purchases from Suppliers (Stock engine increases stock automatically)
  console.log("\nSeeding Purchases...");
  
  // Purchase 1: P&G (Stock buy-in for Pampers)
  const pur1 = await purchaseModel.createPurchase({
    supplierId: supPG.id,
    purchaseDate: new Date(),
    discount: 5000.00,
    paidAmount: 60000.00, // Total = 50*1000 + 50*1100 = 105,000 - 5000 = 100,000. Remaining balance: 40,000
    description: "Bulk diapers buy-in",
    createdById: userId,
    items: [
      { productId: dbProducts["PAM-SZ3"].id, quantity: 50, unitCost: 1000.00 },
      { productId: dbProducts["PAM-SZ4"].id, quantity: 50, unitCost: 1100.00 }
    ]
  });
  console.log(`Recorded Purchase 1: ${pur1.purchaseNo}, Supplier Balance: 40,000`);

  // Purchase 2: Rose Petal Corp (Tissues)
  const pur2 = await purchaseModel.createPurchase({
    supplierId: supRP.id,
    purchaseDate: new Date(),
    discount: 0.00,
    paidAmount: 30000.00, // Total = 200 * 150 = 30,000. Fully paid.
    description: "Tissue stock order",
    createdById: userId,
    items: [
      { productId: dbProducts["RP-TISSUE"].id, quantity: 200, unitCost: 150.00 }
    ]
  });
  console.log(`Recorded Purchase 2: ${pur2.purchaseNo}, Supplier Balance: 0`);

  // Purchase 3: Unilever (Wipes and soaps)
  const pur3 = await purchaseModel.createPurchase({
    supplierId: supUnilever.id,
    purchaseDate: new Date(),
    discount: 2000.00,
    paidAmount: 0.00, // Total = 100*300 + 300*80 = 54,000 - 2000 = 52,000. Unpaid.
    description: "Wipes and dettol bar order",
    createdById: userId,
    items: [
      { productId: dbProducts["JB-WIPES80"].id, quantity: 100, unitCost: 300.00 },
      { productId: dbProducts["DET-SOAP"].id, quantity: 300, unitCost: 80.00 }
    ]
  });
  console.log(`Recorded Purchase 3: ${pur3.purchaseNo}, Supplier Balance: 52,000`);

  // 10. Record Purchase Returns (Stock reduces, balance decreases)
  console.log("\nSeeding Purchase Returns...");
  const pr1 = await purchaseReturnModel.createPurchaseReturn({
    supplierId: supPG.id,
    purchaseId: pur1.id,
    returnDate: new Date(),
    reason: "Damaged packaging return",
    createdById: userId,
    items: [
      { productId: dbProducts["PAM-SZ3"].id, quantity: 5, unitCost: 1000.00 } // Total return value: 5000. Reduces balance from 40k to 35k.
    ]
  });
  console.log(`Recorded Purchase Return: ${pr1.returnNo}, Supplier Balance: 35,000`);

  // 11. Set Sales targets
  console.log("\nSetting monthly targets for salesmen...");
  const now = new Date();
  const currentMonthStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  await targetModel.setTarget(smSameer.id, { month: currentMonthStr, targetAmount: 100000.00, description: "Diaper sales push", createdById: userId });
  await targetModel.setTarget(smJohn.id, { month: currentMonthStr, targetAmount: 150000.00, description: "Wipes and tissue focus", createdById: userId });

  // 12. Record Sales Invoices (Stock engine decreases stock automatically)
  console.log("\nSeeding Sales Invoices...");

  // Invoice 1: Credit Sale to Super Mart (Attributed to Sameer Katija)
  const inv1 = await invoiceModel.createInvoice({
    customerId: custSuper.id,
    salesmanId: smSameer.id,
    saleType: "CREDIT",
    invoiceDate: new Date(),
    discount: 1000.00,
    paidAmount: 10000.00, // Total = 20*1200 + 30*200 = 30,000 - 1000 = 29,000. Customer pays 10,000. Credit balance: 19,000
    description: "Credit invoice Super Mart",
    createdById: userId,
    items: [
      { productId: dbProducts["PAM-SZ3"].id, quantity: 20, unitPrice: 1200.00 }, // in stock (45 remaining)
      { productId: dbProducts["RP-TISSUE"].id, quantity: 30, unitPrice: 200.00 }  // in stock (170 remaining)
    ]
  });
  console.log(`Recorded Invoice 1: ${inv1.invoiceNo}, Customer Balance: 19,000`);

  // Invoice 2: Credit Sale to General Store (Attributed to John Doe)
  const inv2 = await invoiceModel.createInvoice({
    customerId: custGeneral.id,
    salesmanId: smJohn.id,
    saleType: "CREDIT",
    invoiceDate: new Date(),
    discount: 500.00,
    paidAmount: 0.00, // Total = 15*1300 + 50*100 = 24,500 - 500 = 24,000. Customer pays 0. Credit balance: 24,000
    description: "Credit invoice General Store",
    createdById: userId,
    items: [
      { productId: dbProducts["PAM-SZ4"].id, quantity: 15, unitPrice: 1300.00 }, // in stock (35 remaining)
      { productId: dbProducts["DET-SOAP"].id, quantity: 50, unitPrice: 100.00 }   // in stock (250 remaining)
    ]
  });
  console.log(`Recorded Invoice 2: ${inv2.invoiceNo}, Customer Balance: 24,000`);

  // Invoice 3: Cash Counter Sale (No customer ID, Walk-in)
  const inv3 = await invoiceModel.createInvoice({
    customerId: null,
    salesmanId: null,
    saleType: "CASH",
    invoiceDate: new Date(),
    discount: 0.00,
    paidAmount: 760.00, // Total = 2 * 380 = 760. Fully paid at counter.
    description: "Cash walk-in customer",
    createdById: userId,
    items: [
      { productId: dbProducts["JB-WIPES80"].id, quantity: 2, unitPrice: 380.00 } // in stock (98 remaining)
    ]
  });
  console.log(`Recorded Invoice 3 (CASH): ${inv3.invoiceNo}, Counter sale.`);

  // 13. Record Sales Returns
  console.log("\nSeeding Sales Returns...");
  const sr1 = await salesReturnModel.createSalesReturn({
    customerId: custSuper.id,
    invoiceId: inv1.id,
    returnDate: new Date(),
    reason: "Damaged tissues returned",
    createdById: userId,
    items: [
      { productId: dbProducts["RP-TISSUE"].id, quantity: 5, unitPrice: 200.00 } // Return value: 5 * 200 = 1000. Reduces balance from 19k to 18k.
    ]
  });
  console.log(`Recorded Sales Return: ${sr1.returnNo}, Customer Balance: 18,000`);

  // 14. Record Customer & Supplier Ledger Payments
  console.log("\nSeeding Payment Settlements...");
  
  // Customer Super Mart pays off 8,000 more against Invoice 1 balance due
  const payCust = await paymentModel.recordCustomerPayment({
    customerId: custSuper.id,
    invoiceId: inv1.id,
    amount: 8000.00, // Reduces balance from 18k to 10k.
    paymentDate: new Date(),
    description: "Super Mart part settlement",
    createdById: userId
  });
  console.log(`Recorded Customer Payment: ID = ${payCust.id}, Amount = ${payCust.amount}, Customer Balance: 10,000`);

  // We pay Supplier P&G 15,000 against their outstanding balance due
  const paySup = await paymentModel.recordSupplierPayment({
    supplierId: supPG.id,
    purchaseId: pur1.id,
    amount: 15000.00, // Reduces balance from 35k to 20k.
    paymentDate: new Date(),
    description: "P&G bank transfer pay",
    createdById: userId
  });
  console.log(`Recorded Supplier Payment: ID = ${paySup.id}, Amount = ${paySup.amount}, Supplier Balance: 20,000`);

  // 15. Seed Business Expenses
  console.log("\nSeeding business expenses...");
  await expenseModel.createExpense({ categoryId: expRent.id, amount: 20000.00, expenseDate: new Date(), description: "Office rent current month", createdById: userId });
  await expenseModel.createExpense({ categoryId: expUtilities.id, amount: 6500.00, expenseDate: new Date(), description: "Electricity bill", createdById: userId });
  await expenseModel.createExpense({ categoryId: expTransport.id, amount: 4800.00, expenseDate: new Date(), description: "Van fuel refills", createdById: userId });
  console.log("Seeded 3 expenses.");

  console.log("\n=== DATABASE SEEDING COMPLETED SUCCESSFULLY ===");
  console.log("You can now test all dashboard reports and charts using this dataset!");
}

main()
  .catch((err) => {
    console.error("\n*** SEEDING FAILED ***", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
