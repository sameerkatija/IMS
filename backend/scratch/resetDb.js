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

}
main();