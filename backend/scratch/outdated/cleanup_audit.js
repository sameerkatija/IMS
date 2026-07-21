require("dotenv").config();
const prisma = require("../config/prisma");

async function run() {
  const products = await prisma.product.findMany({ where: { sku: { startsWith: "PRB-" } } });
  for (const p of products) {
    await prisma.stockAdjustment.deleteMany({ where: { productId: p.id } });
    await prisma.stockMovement.deleteMany({ where: { productId: p.id } });
    await prisma.invoiceItem.deleteMany({ where: { productId: p.id } });
    await prisma.salesReturnItem.deleteMany({ where: { productId: p.id } });
    await prisma.purchaseReturnItem.deleteMany({ where: { productId: p.id } });
    await prisma.purchaseItem.deleteMany({ where: { productId: p.id } });
    try { await prisma.product.delete({ where: { id: p.id } }); } catch {}
  }
  const suppls = await prisma.supplier.findMany({ where: { name: { startsWith: "SP" } } });
  for (const s of suppls) {
    await prisma.supplierLedger.deleteMany({ where: { supplierId: s.id } });
    await prisma.supplierPayment.deleteMany({ where: { supplierId: s.id } });
    await prisma.purchaseReturn.deleteMany({ where: { supplierId: s.id } });
    await prisma.purchase.deleteMany({ where: { supplierId: s.id } });
    await prisma.supplier.delete({ where: { id: s.id } });
  }
  const custs = await prisma.customer.findMany({ where: { name: { startsWith: "CU" } } });
  for (const c of custs) {
    await prisma.paymentAllocation.deleteMany({ where: { invoice: { customerId: c.id } } });
    await prisma.customerLedger.deleteMany({ where: { customerId: c.id } });
    await prisma.customerPayment.deleteMany({ where: { customerId: c.id } });
    await prisma.salesReturn.deleteMany({ where: { customerId: c.id } });
    await prisma.invoice.deleteMany({ where: { customerId: c.id } });
    await prisma.customer.delete({ where: { id: c.id } });
  }
  const expCat = await prisma.expenseCategory.findFirst({ where: { name: "inventory loss/shrinkage" } });
  if (expCat) {
    await prisma.expense.deleteMany({ where: { categoryId: expCat.id } });
  }
  console.log("Cleanup done.");
  await prisma.$disconnect();
}

run().catch(async e => { console.error(e); await prisma.$disconnect(); });
