require("dotenv").config();
const prisma = require("../config/prisma");

async function runAudit() {
  console.log("=== RUNNING DATA INTEGRITY AUDIT ===");

  // 1. Check Product Stock Quantity vs StockMovement Sum
  console.log("\n1. Auditing Product stockQuantity vs StockMovement sum...");
  const products = await prisma.product.findMany();
  for (const product of products) {
    const movements = await prisma.stockMovement.findMany({
      where: { productId: product.id }
    });
    const movementSum = movements.reduce((sum, mv) => {
      return sum + (mv.type === "IN" ? mv.quantity : -mv.quantity);
    }, 0);
    if (product.stockQuantity !== movementSum) {
      console.error(`❌ PRODUCT MISMATCH: Product ID ${product.id} (${product.name}) has stockQuantity = ${product.stockQuantity}, but movements sum to ${movementSum}. Drift = ${product.stockQuantity - movementSum}`);
    } else {
      console.log(`✓ Product ID ${product.id} (${product.name}) stockQuantity matches movement sum (${product.stockQuantity}).`);
    }
  }

  // 2. Check Customer Balance vs CustomerLedger Running Balance
  console.log("\n2. Auditing Customer balance vs CustomerLedger sum...");
  const customers = await prisma.customer.findMany();
  for (const customer of customers) {
    const ledgerEntries = await prisma.customerLedger.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "asc" }
    });
    const ledgerSum = ledgerEntries.reduce((sum, entry) => {
      return sum + Number(entry.debit) - Number(entry.credit);
    }, 0);
    const balance = Number(customer.balance);
    if (Math.abs(balance - ledgerSum) > 0.01) {
      console.error(`❌ CUSTOMER MISMATCH: Customer ID ${customer.id} (${customer.name}) has balance = ${balance}, but ledger entries sum to ${ledgerSum}. Drift = ${balance - ledgerSum}`);
    } else {
      console.log(`✓ Customer ID ${customer.id} (${customer.name}) balance matches ledger sum (${balance}).`);
    }
    
    // Check if running balances in ledger are correctly calculated
    let calcBalance = 0;
    let runningMismatches = 0;
    for (const entry of ledgerEntries) {
      calcBalance += Number(entry.debit) - Number(entry.credit);
      if (Math.abs(calcBalance - Number(entry.balance)) > 0.01) {
        runningMismatches++;
      }
    }
    if (runningMismatches > 0) {
      console.error(`❌ CUSTOMER LEDGER RUNNING BALANCE ERROR: Customer ID ${customer.id} has ${runningMismatches} rows with incorrect running balances.`);
    }
  }

  // 3. Check Supplier Balance vs SupplierLedger Running Balance
  console.log("\n3. Auditing Supplier balance vs SupplierLedger sum...");
  const suppliers = await prisma.supplier.findMany();
  for (const supplier of suppliers) {
    const ledgerEntries = await prisma.supplierLedger.findMany({
      where: { supplierId: supplier.id },
      orderBy: { createdAt: "asc" }
    });
    const ledgerSum = ledgerEntries.reduce((sum, entry) => {
      return sum + Number(entry.credit) - Number(entry.debit);
    }, 0);
    const balance = Number(supplier.balance);
    if (Math.abs(balance - ledgerSum) > 0.01) {
      console.error(`❌ SUPPLIER MISMATCH: Supplier ID ${supplier.id} (${supplier.name}) has balance = ${balance}, but ledger entries sum to ${ledgerSum}. Drift = ${balance - ledgerSum}`);
    } else {
      console.log(`✓ Supplier ID ${supplier.id} (${supplier.name}) balance matches ledger sum (${balance}).`);
    }

    let calcBalance = 0;
    let runningMismatches = 0;
    for (const entry of ledgerEntries) {
      calcBalance += Number(entry.credit) - Number(entry.debit);
      if (Math.abs(calcBalance - Number(entry.balance)) > 0.01) {
        runningMismatches++;
      }
    }
    if (runningMismatches > 0) {
      console.error(`❌ SUPPLIER LEDGER RUNNING BALANCE ERROR: Supplier ID ${supplier.id} has ${runningMismatches} rows with incorrect running balances.`);
    }
  }

  // 4. Check Invoice Totals vs InvoiceItems Sum
  console.log("\n4. Auditing Invoice totals vs InvoiceItems sum...");
  const invoices = await prisma.invoice.findMany({
    include: { items: true }
  });
  for (const inv of invoices) {
    const itemsSum = inv.items.reduce((sum, item) => sum + Number(item.totalPrice), 0);
    const expectedTotal = itemsSum - Number(inv.discount);
    if (Math.abs(Number(inv.total) - expectedTotal) > 0.01) {
      console.error(`❌ INVOICE MISMATCH: Invoice ${inv.invoiceNo} has total = ${inv.total}, but items sum minus discount is ${expectedTotal}. Drift = ${Number(inv.total) - expectedTotal}`);
    } else {
      console.log(`✓ Invoice ${inv.invoiceNo} total matches items sum minus discount.`);
    }
  }

  // 5. Check Purchase Totals vs PurchaseItems Sum
  console.log("\n5. Auditing Purchase totals vs PurchaseItems sum...");
  const purchases = await prisma.purchase.findMany({
    include: { items: true }
  });
  for (const pur of purchases) {
    const itemsSum = pur.items.reduce((sum, item) => sum + Number(item.totalCost), 0);
    const expectedTotal = itemsSum - Number(pur.discount);
    if (Math.abs(Number(pur.total) - expectedTotal) > 0.01) {
      console.error(`❌ PURCHASE MISMATCH: Purchase ${pur.purchaseNo} has total = ${pur.total}, but items sum minus discount is ${expectedTotal}. Drift = ${Number(pur.total) - expectedTotal}`);
    } else {
      console.log(`✓ Purchase ${pur.purchaseNo} total matches items sum minus discount.`);
    }
  }

  // 6. Check Payment Allocations vs Payments
  console.log("\n6. Auditing Payment Allocations vs Payment amounts...");
  const payments = await prisma.customerPayment.findMany({
    include: { allocations: true }
  });
  for (const pay of payments) {
    const allocSum = pay.allocations.reduce((sum, alloc) => sum + Number(alloc.amountAllocated), 0);
    if (allocSum > Number(pay.amount)) {
      console.error(`❌ OVER-ALLOCATION: Payment ID ${pay.id} has amount = ${pay.amount}, but allocations sum to ${allocSum}. Over allocated by = ${allocSum - Number(pay.amount)}`);
    } else {
      console.log(`✓ Payment ID ${pay.id} allocations (${allocSum}) do not exceed payment amount (${pay.amount}).`);
    }
  }

  await prisma.$disconnect();
}

runAudit();
