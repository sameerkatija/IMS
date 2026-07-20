require("dotenv").config();
const prisma = require("../config/prisma");

async function main() {
  console.log("=== STARTING DATABASE TRANSACTIONS CLEANUP ===");
  console.log("Preserving: Product, Category, User models.");

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Delete payment allocations
      console.log("Deleting PaymentAllocation records...");
      const paymentAllocations = await tx.paymentAllocation.deleteMany({});
      console.log(`Deleted ${paymentAllocations.count} PaymentAllocation rows.`);

      // 2. Delete customer ledger entries
      console.log("Deleting CustomerLedger records...");
      const customerLedger = await tx.customerLedger.deleteMany({});
      console.log(`Deleted ${customerLedger.count} CustomerLedger rows.`);

      // 3. Delete supplier ledger entries
      console.log("Deleting SupplierLedger records...");
      const supplierLedger = await tx.supplierLedger.deleteMany({});
      console.log(`Deleted ${supplierLedger.count} SupplierLedger rows.`);

      // 4. Delete customer payments
      console.log("Deleting CustomerPayment records...");
      const customerPayment = await tx.customerPayment.deleteMany({});
      console.log(`Deleted ${customerPayment.count} CustomerPayment rows.`);

      // 5. Delete supplier payments
      console.log("Deleting SupplierPayment records...");
      const supplierPayment = await tx.supplierPayment.deleteMany({});
      console.log(`Deleted ${supplierPayment.count} SupplierPayment rows.`);

      // 6. Delete stock movements
      console.log("Deleting StockMovement records...");
      const stockMovement = await tx.stockMovement.deleteMany({});
      console.log(`Deleted ${stockMovement.count} StockMovement rows.`);

      // 7. Delete sales return items
      console.log("Deleting SalesReturnItem records...");
      const salesReturnItem = await tx.salesReturnItem.deleteMany({});
      console.log(`Deleted ${salesReturnItem.count} SalesReturnItem rows.`);

      // 8. Delete sales returns
      console.log("Deleting SalesReturn records...");
      const salesReturn = await tx.salesReturn.deleteMany({});
      console.log(`Deleted ${salesReturn.count} SalesReturn rows.`);

      // 9. Delete invoice items
      console.log("Deleting InvoiceItem records...");
      const invoiceItem = await tx.invoiceItem.deleteMany({});
      console.log(`Deleted ${invoiceItem.count} InvoiceItem rows.`);

      // 10. Delete invoices
      console.log("Deleting Invoice records...");
      const invoice = await tx.invoice.deleteMany({});
      console.log(`Deleted ${invoice.count} Invoice rows.`);

      // 11. Delete purchase return items
      console.log("Deleting PurchaseReturnItem records...");
      const purchaseReturnItem = await tx.purchaseReturnItem.deleteMany({});
      console.log(`Deleted ${purchaseReturnItem.count} PurchaseReturnItem rows.`);

      // 12. Delete purchase returns
      console.log("Deleting PurchaseReturn records...");
      const purchaseReturn = await tx.purchaseReturn.deleteMany({});
      console.log(`Deleted ${purchaseReturn.count} PurchaseReturn rows.`);

      // 13. Delete purchase items
      console.log("Deleting PurchaseItem records...");
      const purchaseItem = await tx.purchaseItem.deleteMany({});
      console.log(`Deleted ${purchaseItem.count} PurchaseItem rows.`);

      // 14. Delete purchases
      console.log("Deleting Purchase records...");
      const purchase = await tx.purchase.deleteMany({});
      console.log(`Deleted ${purchase.count} Purchase rows.`);

      // 15. Delete salesman targets
      console.log("Deleting SalesTarget records...");
      const salesTarget = await tx.salesTarget.deleteMany({});
      console.log(`Deleted ${salesTarget.count} SalesTarget rows.`);

      // 16. Delete salesman records
      console.log("Deleting Salesman records...");
      const salesman = await tx.salesman.deleteMany({});
      console.log(`Deleted ${salesman.count} Salesman rows.`);

      // 17. Delete expense entries
      console.log("Deleting Expense records...");
      const expense = await tx.expense.deleteMany({});
      console.log(`Deleted ${expense.count} Expense rows.`);

      // 18. Delete expense categories
      console.log("Deleting ExpenseCategory records...");
      const expenseCategory = await tx.expenseCategory.deleteMany({});
      console.log(`Deleted ${expenseCategory.count} ExpenseCategory rows.`);

      // 19. Delete customer accounts
      console.log("Deleting Customer records...");
      const customer = await tx.customer.deleteMany({});
      console.log(`Deleted ${customer.count} Customer rows.`);

      // 20. Delete supplier records
      console.log("Deleting Supplier records...");
      const supplier = await tx.supplier.deleteMany({});
      console.log(`Deleted ${supplier.count} Supplier rows.`);

      // Reset product stock quantity to 0 since all purchases and sales are wiped
      console.log("Resetting all Product stock quantities to 0...");
      const resetProducts = await tx.product.updateMany({
        data: { stockQuantity: 0 }
      });
      console.log(`Reset stockQuantity to 0 on ${resetProducts.count} Product rows.`);
    });

    console.log("\n✓ Database cleanup completed successfully!");
    console.log("All transactions, links, ledgers, customers, and suppliers have been deleted.");
    console.log("Product, Category, and User configurations were preserved.");
  } catch (error) {
    console.error("\n❌ Database cleanup failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
