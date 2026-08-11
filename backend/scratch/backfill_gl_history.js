require("dotenv").config();
const prisma = require("../config/prisma");
const glModel = require("../models/gl-model");
const { seedGLAccounts } = require("../config/seed-gl-accounts");

async function main() {
  console.log("=========================================================");
  console.log("  Starting Phase 12 General Ledger Historical Backfill   ");
  console.log("=========================================================\n");

  // Step A: Ensure Chart of Accounts exist
  await seedGLAccounts(prisma);
  console.log("✔ GL Accounts verified / seeded.");

  let totalInvoices = 0;
  let totalPurchases = 0;
  let totalSalesReturns = 0;
  let totalPurchaseReturns = 0;
  let totalCustomerPayments = 0;
  let totalSupplierPayments = 0;
  let totalExpenses = 0;

  // 1. Backfill Invoices
  const invoices = await prisma.invoice.findMany({
    include: { items: true },
  });

  for (const inv of invoices) {
    const existingCount = await prisma.gLJournalEntry.count({
      where: { referenceType: "INVOICE", referenceId: inv.id },
    });
    if (existingCount > 0) continue;

    const subtotal = Number(inv.subtotal);
    const discount = Number(inv.discount || 0);
    const transportDiscount = Number(inv.transportDiscount || 0);
    const total = Number(inv.total);
    const netPayable = total - transportDiscount;

    let totalCOGS = 0;
    for (const item of inv.items) {
      totalCOGS += item.quantity * Number(item.costPriceAtSale);
    }
    totalCOGS = Math.round(totalCOGS * 100) / 100;

    const glEntries = [];
    if (inv.saleType === "CREDIT") {
      glEntries.push({ code: "1100", debit: netPayable, credit: 0, description: `AR for Invoice ${inv.invoiceNo}` });
    } else {
      glEntries.push({ code: "1000", debit: netPayable, credit: 0, description: `Cash for Invoice ${inv.invoiceNo}` });
    }
    glEntries.push({ code: "4000", debit: 0, credit: total, description: `Sales Revenue for Invoice ${inv.invoiceNo}` });

    if (transportDiscount > 0) {
      glEntries.push({ code: "6000", debit: transportDiscount, credit: 0, description: `Transport discount expense for Invoice ${inv.invoiceNo}` });
    }

    if (totalCOGS > 0) {
      glEntries.push({ code: "5000", debit: totalCOGS, credit: 0, description: `COGS for Invoice ${inv.invoiceNo}` });
      glEntries.push({ code: "1300", debit: 0, credit: totalCOGS, description: `Inventory reduction for Invoice ${inv.invoiceNo}` });
    }

    await glModel.postGLJournalEntries(
      glEntries,
      { referenceType: "INVOICE", referenceId: inv.id, createdById: inv.createdById, entryDate: inv.invoiceDate || inv.createdAt },
      prisma
    );
    totalInvoices++;
  }
  console.log(`✔ Invoices backfilled: ${totalInvoices}`);

  // 2. Backfill Purchases
  const purchases = await prisma.purchase.findMany();
  for (const pur of purchases) {
    const existingCount = await prisma.gLJournalEntry.count({
      where: { referenceType: "PURCHASE", referenceId: pur.id },
    });
    if (existingCount > 0) continue;

    const total = Number(pur.total);
    const paidAmount = Number(pur.paidAmount);

    const glEntries = [
      { code: "1300", debit: total, credit: 0, description: `Inventory asset received for Purchase ${pur.purchaseNo}` },
    ];
    if (paidAmount >= total) {
      glEntries.push({ code: "1000", debit: 0, credit: total, description: `Cash paid for Purchase ${pur.purchaseNo}` });
    } else {
      glEntries.push({ code: "2000", debit: 0, credit: total, description: `AP recorded for Purchase ${pur.purchaseNo}` });
    }

    await glModel.postGLJournalEntries(
      glEntries,
      { referenceType: "PURCHASE", referenceId: pur.id, createdById: pur.createdById, entryDate: pur.purchaseDate || pur.createdAt },
      prisma
    );
    totalPurchases++;
  }
  console.log(`✔ Purchases backfilled: ${totalPurchases}`);

  // 3. Backfill Sales Returns
  const salesReturns = await prisma.salesReturn.findMany({
    include: { items: true, invoice: true },
  });

  for (const ret of salesReturns) {
    const existingCount = await prisma.gLJournalEntry.count({
      where: { referenceType: "SALES_RETURN", referenceId: ret.id },
    });
    if (existingCount > 0) continue;

    const totalAmount = Number(ret.totalAmount);
    let totalReturnedCOGS = 0;
    for (const item of ret.items) {
      totalReturnedCOGS += item.quantity * Number(item.costPriceAtSale);
    }
    totalReturnedCOGS = Math.round(totalReturnedCOGS * 100) / 100;

    const glEntries = [
      { code: "4100", debit: totalAmount, credit: 0, description: `Sales Return ${ret.returnNo || ret.id}` },
    ];

    if (ret.customerId && ret.refundType === "CREDIT") {
      glEntries.push({ code: "1100", debit: 0, credit: totalAmount, description: `AR credit for Sales Return ${ret.returnNo || ret.id}` });
    } else {
      glEntries.push({ code: "1000", debit: 0, credit: totalAmount, description: `Cash refund for Sales Return ${ret.returnNo || ret.id}` });
    }

    if (totalReturnedCOGS > 0) {
      glEntries.push({ code: "1300", debit: totalReturnedCOGS, credit: 0, description: `Stock recovery for Sales Return ${ret.returnNo || ret.id}` });
      glEntries.push({ code: "5000", debit: 0, credit: totalReturnedCOGS, description: `COGS reversal for Sales Return ${ret.returnNo || ret.id}` });
    }

    await glModel.postGLJournalEntries(
      glEntries,
      { referenceType: "SALES_RETURN", referenceId: ret.id, createdById: ret.createdById, entryDate: ret.returnDate || ret.createdAt },
      prisma
    );
    totalSalesReturns++;
  }
  console.log(`✔ Sales Returns backfilled: ${totalSalesReturns}`);

  // 4. Backfill Purchase Returns
  const purchaseReturns = await prisma.purchaseReturn.findMany({
    include: { items: true },
  });

  for (const pret of purchaseReturns) {
    const existingCount = await prisma.gLJournalEntry.count({
      where: { referenceType: "PURCHASE_RETURN", referenceId: pret.id },
    });
    if (existingCount > 0) continue;

    const totalAmount = Number(pret.totalAmount);
    let inventoryValueAtPoolWAC = 0;
    for (const item of pret.items) {
      const productSnap = await prisma.product.findUnique({ where: { id: item.productId } });
      const currentWAC = Number(productSnap?.weightedAvgCost || item.unitCost);
      inventoryValueAtPoolWAC += item.quantity * currentWAC;
    }
    inventoryValueAtPoolWAC = Math.round(inventoryValueAtPoolWAC * 100) / 100;

    const variance = Math.round((totalAmount - inventoryValueAtPoolWAC) * 100) / 100;
    const glEntries = [
      { code: "2000", debit: totalAmount, credit: 0, description: `AP reduction for Purchase Return ${pret.returnNo || pret.id}` },
      { code: "1300", debit: 0, credit: inventoryValueAtPoolWAC, description: `Inventory stock OUT at pool WAC for ${pret.returnNo || pret.id}` },
    ];

    if (variance > 0) {
      glEntries.push({ code: "5100", debit: 0, credit: variance, description: `Purchase Return Variance gain for ${pret.returnNo || pret.id}` });
    } else if (variance < 0) {
      glEntries.push({ code: "5100", debit: Math.abs(variance), credit: 0, description: `Purchase Return Variance loss for ${pret.returnNo || pret.id}` });
    }

    await glModel.postGLJournalEntries(
      glEntries,
      { referenceType: "PURCHASE_RETURN", referenceId: pret.id, createdById: pret.createdById, entryDate: pret.returnDate || pret.createdAt },
      prisma
    );
    totalPurchaseReturns++;
  }
  console.log(`✔ Purchase Returns backfilled: ${totalPurchaseReturns}`);

  // 5. Backfill Customer Payments
  const customerPayments = await prisma.customerPayment.findMany();
  for (const cp of customerPayments) {
    const existingCount = await prisma.gLJournalEntry.count({
      where: { referenceType: "PAYMENT", referenceId: cp.id, description: { contains: "Customer" } },
    });
    if (existingCount > 0) continue;

    const amt = Number(cp.amount);
    const isCreditApp = cp.paymentType === "CREDIT_APPLICATION";

    const glEntries = [];
    if (!isCreditApp) {
      glEntries.push({ code: "1000", debit: amt, credit: 0, description: `Cash received from Customer Payment #${cp.id}` });
      glEntries.push({ code: "1100", debit: 0, credit: amt, description: `AR reduction from Customer Payment #${cp.id}` });
    } else {
      glEntries.push({ code: "2100", debit: amt, credit: 0, description: `Customer deposit credit application #${cp.id}` });
      glEntries.push({ code: "1100", debit: 0, credit: amt, description: `AR reduction from Store Credit #${cp.id}` });
    }

    await glModel.postGLJournalEntries(
      glEntries,
      { referenceType: "PAYMENT", referenceId: cp.id, createdById: cp.createdById, entryDate: cp.paymentDate || cp.createdAt },
      prisma
    );
    totalCustomerPayments++;
  }
  console.log(`✔ Customer Payments backfilled: ${totalCustomerPayments}`);

  // 6. Backfill Supplier Payments
  const supplierPayments = await prisma.supplierPayment.findMany();
  for (const sp of supplierPayments) {
    const existingCount = await prisma.gLJournalEntry.count({
      where: { referenceType: "PAYMENT", referenceId: sp.id, description: { contains: "Supplier" } },
    });
    if (existingCount > 0) continue;

    const amt = Number(sp.amount);

    const glEntries = [
      { code: "2000", debit: amt, credit: 0, description: `AP reduction from Supplier Payment #${sp.id}` },
      { code: "1000", debit: 0, credit: amt, description: `Cash paid for Supplier Payment #${sp.id}` },
    ];

    await glModel.postGLJournalEntries(
      glEntries,
      { referenceType: "PAYMENT", referenceId: sp.id, createdById: sp.createdById, entryDate: sp.paymentDate || sp.createdAt },
      prisma
    );
    totalSupplierPayments++;
  }
  console.log(`✔ Supplier Payments backfilled: ${totalSupplierPayments}`);

  // 7. Backfill Expenses
  const expenses = await prisma.expense.findMany({ include: { category: true } });
  for (const exp of expenses) {
    const existingCount = await prisma.gLJournalEntry.count({
      where: { referenceType: "PAYMENT", referenceId: exp.id, description: { contains: "Expense" } },
    });
    if (existingCount > 0) continue;

    const amt = Number(exp.amount);
    await glModel.postGLJournalEntries(
      [
        { code: "6000", debit: amt, credit: 0, description: `Expense: ${exp.category.name}` },
        { code: "1000", debit: 0, credit: amt, description: `Cash paid for Expense #${exp.id}` },
      ],
      { referenceType: "PAYMENT", referenceId: exp.id, createdById: exp.createdById, entryDate: exp.expenseDate || exp.createdAt },
      prisma
    );
    totalExpenses++;
  }
  console.log(`✔ Expenses backfilled: ${totalExpenses}`);

  console.log("\n=========================================================");
  console.log("  🎉 GL HISTORICAL BACKFILL COMPLETED SUCCESSFULLY!  ");
  console.log("=========================================================");
}

main()
  .catch((e) => {
    console.error("Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
