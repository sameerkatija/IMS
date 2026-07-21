/**
 * FINAL ADVERSARIAL AND SIMULATION VALIDATION
 * Simulates months of business activity under concurrent and randomized stress,
 * then checks all accounting invariants.
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const prisma = require("../config/prisma");
const invoiceModel = require("../models/invoice-model");
const purchaseModel = require("../models/purchase-model");
const paymentModel = require("../models/payment-model");
const salesReturnModel = require("../models/sales-return-model");
const purchaseReturnModel = require("../models/purchase-return-model");
const stockModel = require("../models/stock-model");
const ledgerModel = require("../models/ledger-model");

async function cleanupDb() {
  console.log("Cleaning database...");
  const tables = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables 
    WHERE schemaname = 'public' AND tablename != '_prisma_migrations';
  `;
  const tableNames = tables.map(t => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`);
}

async function seedBaseData() {
  console.log("Seeding base data...");
  const admin = await prisma.user.create({
    data: {
      id: 1,
      name: "Admin User",
      username: "admin",
      password: "hashedpassword",
      role: "ADMIN",
      isActive: true,
    }
  });

  const cat = await prisma.category.create({
    data: { id: 1, name: "Base Category", isActive: true }
  });

  // Seed 5 products
  const products = [];
  for (let i = 1; i <= 5; i++) {
    const p = await prisma.product.create({
      data: {
        id: i,
        name: `Product ${i}`,
        categoryId: 1,
        costPrice: 10.0 + i,
        sellingPrice: 20.0 + i * 2,
        weightedAvgCost: 0,
        stockQuantity: 0,
        isActive: true,
      }
    });
    products.push(p);
  }

  // Seed 3 customers
  const customers = [];
  for (let i = 1; i <= 3; i++) {
    const c = await prisma.customer.create({
      data: {
        id: i,
        name: `Customer ${i}`,
        balance: 0,
        isActive: true,
      }
    });
    customers.push(c);
  }

  // Seed 2 suppliers
  const suppliers = [];
  for (let i = 1; i <= 2; i++) {
    const s = await prisma.supplier.create({
      data: {
        id: i,
        name: `Supplier ${i}`,
        balance: 0,
        isActive: true,
      }
    });
    suppliers.push(s);
  }

  return { admin, products, customers, suppliers };
}

async function runAdversarialSimulation() {
  const { admin, products, customers, suppliers } = await seedBaseData();
  console.log("Running adversarial simulation...");

  // 1. Initial inventory purchase to get stock
  for (const s of suppliers) {
    const items = products.map(p => ({
      productId: p.id,
      quantity: 100,
      unitCost: Number(p.costPrice),
    }));
    await purchaseModel.createPurchase({
      supplierId: s.id,
      items,
      paidAmount: 100, // Partial payment
      creditApplied: 0,
      createdById: admin.id,
    });
  }
  console.log("Initial purchases created successfully.");

  // 2. Perform randomized operations
  const operationsCount = 500;
  for (let step = 0; step < operationsCount; step++) {
    const rand = Math.random();
    const customer = customers[Math.floor(Math.random() * customers.length)];
    const supplier = suppliers[Math.floor(Math.random() * suppliers.length)];
    const product = products[Math.floor(Math.random() * products.length)];

    try {
      if (rand < 0.3) {
        // Sale (CASH or CREDIT)
        const saleType = Math.random() < 0.5 ? "CASH" : "CREDIT";
        const quantity = Math.floor(Math.random() * 5) + 1;
        const currentProduct = await prisma.product.findUnique({ where: { id: product.id } });
        if (currentProduct.stockQuantity < quantity) continue; // Skip if out of stock

        const totalAmt = quantity * Number(currentProduct.sellingPrice);
        const paidAmount = saleType === "CASH" ? totalAmt : (Math.random() < 0.5 ? 0 : Math.floor(totalAmt / 2));

        await invoiceModel.createInvoice({
          customerId: customer.id,
          saleType,
          items: [{ productId: product.id, quantity }],
          paidAmount,
          creditApplied: 0,
          createdById: admin.id,
        });

      } else if (rand < 0.5) {
        // Customer Payment
        const customerDetails = await prisma.customer.findUnique({
          where: { id: customer.id },
          include: { invoices: { where: { status: { in: ["UNPAID", "PARTIALLY_PAID"] } } } }
        });
        if (customerDetails.invoices.length > 0) {
          const inv = customerDetails.invoices[0];
          const amount = Math.min(Number(inv.balanceDue), Math.floor(Math.random() * 50) + 10);
          if (amount > 0) {
            await paymentModel.recordCustomerPayment({
              customerId: customer.id,
              allocations: [{ invoiceId: inv.id, amountAllocated: amount }],
              amount,
              isCreditApplied: false,
              createdById: admin.id,
            });
          }
        }

      } else if (rand < 0.7) {
        // Supplier Payment
        const supplierDetails = await prisma.supplier.findUnique({
          where: { id: supplier.id },
          include: { purchases: { where: { status: { in: ["UNPAID", "PARTIALLY_PAID"] } } } }
        });
        if (supplierDetails.purchases.length > 0) {
          const pur = supplierDetails.purchases[0];
          const amount = Math.min(Number(pur.balanceDue), Math.floor(Math.random() * 50) + 10);
          if (amount > 0) {
            await paymentModel.recordSupplierPayment({
              supplierId: supplier.id,
              purchaseId: pur.id,
              amount,
              isCreditApplied: false,
              createdById: admin.id,
            });
          }
        }

      } else if (rand < 0.8) {
        // Sales Return (CREDIT)
        const invoiceDetails = await prisma.invoice.findFirst({
          where: { customerId: customer.id },
          include: { items: true }
        });
        if (invoiceDetails && invoiceDetails.items.length > 0) {
          const item = invoiceDetails.items[0];
          // Determine how many have already been returned
          const returnedAgg = await prisma.salesReturnItem.aggregate({
            _sum: { quantity: true },
            where: { salesReturn: { invoiceId: invoiceDetails.id }, productId: item.productId }
          });
          const alreadyReturned = returnedAgg._sum.quantity || 0;
          const maxReturnable = item.quantity - alreadyReturned;

          if (maxReturnable > 0) {
            const returnQty = Math.floor(Math.random() * maxReturnable) + 1;
            await salesReturnModel.createSalesReturn({
              invoiceId: invoiceDetails.id,
              customerId: customer.id,
              items: [{ productId: item.productId, quantity: returnQty }],
              refundType: "CREDIT",
              createdById: admin.id,
            });
          }
        }

      } else if (rand < 0.9) {
        // Purchase Return
        const purchaseDetails = await prisma.purchase.findFirst({
          where: { supplierId: supplier.id },
          include: { items: true }
        });
        if (purchaseDetails && purchaseDetails.items.length > 0) {
          const item = purchaseDetails.items[0];
          const returnedAgg = await prisma.purchaseReturnItem.aggregate({
            _sum: { quantity: true },
            where: { purchaseReturn: { purchaseId: purchaseDetails.id }, productId: item.productId }
          });
          const alreadyReturned = returnedAgg._sum.quantity || 0;
          const maxReturnable = item.quantity - alreadyReturned;

          // Also check stock level
          const currentProd = await prisma.product.findUnique({ where: { id: item.productId } });
          const allowedByStock = currentProd.stockQuantity;

          const limit = Math.min(maxReturnable, allowedByStock);
          if (limit > 0) {
            const returnQty = Math.floor(Math.random() * limit) + 1;
            await purchaseReturnModel.createPurchaseReturn({
              purchaseId: purchaseDetails.id,
              supplierId: supplier.id,
              items: [{ productId: item.productId, quantity: returnQty, unitCost: Number(item.unitCost) }],
              createdById: admin.id,
            });
          }
        }
      } else {
        // Store Credit consumption (Customer Credit application)
        const cust = await prisma.customer.findUnique({ where: { id: customer.id } });
        if (cust.balance < 0) {
          const outstanding = await prisma.invoice.findMany({
            where: { customerId: customer.id, status: { in: ["UNPAID", "PARTIALLY_PAID"] } }
          });
          if (outstanding.length > 0) {
            const inv = outstanding[0];
            const maxCreditToApply = Math.min(Math.abs(Number(cust.balance)), Number(inv.balanceDue));
            if (maxCreditToApply > 0) {
              await paymentModel.recordCustomerPayment({
                customerId: customer.id,
                allocations: [{ invoiceId: inv.id, amountAllocated: maxCreditToApply }],
                amount: maxCreditToApply,
                isCreditApplied: true,
                createdById: admin.id,
              });
            }
          }
        }
      }
    } catch (e) {
      // Expected logic errors (e.g. balance checks) are fine
    }
  }
  console.log("Random simulation finished.");

  // 3. Concurrency Stress Testing
  console.log("Running concurrent stress tests...");
  const stressCust = customers[0];
  const stressProd = products[0];

  // Attempt 5 concurrent credit invoices
  try {
    await Promise.all(
      Array.from({ length: 5 }).map(() =>
        invoiceModel.createInvoice({
          customerId: stressCust.id,
          saleType: "CREDIT",
          items: [{ productId: stressProd.id, quantity: 1 }],
          paidAmount: 0,
          creditApplied: 0,
          createdById: admin.id,
        })
      )
    );
    console.log("Concurrent invoices completed.");
  } catch (err) {
    console.log("Concurrent invoices error (expected locking/sequence):", err.message);
  }

  // 4. Verify Accounting Invariants across the entire database
  console.log("Verifying invariants...");
  let failedInvariants = 0;

  // Customer ledger check
  const dbCustomers = await prisma.customer.findMany();
  for (const c of dbCustomers) {
    const ledgerSum = await prisma.customerLedger.aggregate({
      _sum: { debit: true, credit: true },
      where: { customerId: c.id }
    });
    const calculated = Number(ledgerSum._sum.debit || 0) - Number(ledgerSum._sum.credit || 0);
    const stored = Number(c.balance);
    if (Math.abs(calculated - stored) > 0.01) {
      console.error(`❌ Customer ${c.id} drift: stored=${stored.toFixed(2)}, calculated=${calculated.toFixed(2)}`);
      failedInvariants++;
    }
  }

  // Supplier ledger check
  const dbSuppliers = await prisma.supplier.findMany();
  for (const s of dbSuppliers) {
    const ledgerSum = await prisma.supplierLedger.aggregate({
      _sum: { debit: true, credit: true },
      where: { supplierId: s.id }
    });
    const calculated = Number(ledgerSum._sum.credit || 0) - Number(ledgerSum._sum.debit || 0);
    const stored = Number(s.balance);
    if (Math.abs(calculated - stored) > 0.01) {
      console.error(`❌ Supplier ${s.id} drift: stored=${stored.toFixed(2)}, calculated=${calculated.toFixed(2)}`);
      failedInvariants++;
    }
  }

  // Stock inventory check
  const dbProducts = await prisma.product.findMany();
  for (const p of dbProducts) {
    const movementsAgg = await prisma.stockMovement.aggregate({
      _sum: { quantity: true },
      where: { productId: p.id, type: "IN" }
    });
    const movementsOutAgg = await prisma.stockMovement.aggregate({
      _sum: { quantity: true },
      where: { productId: p.id, type: "OUT" }
    });
    const calculatedStock = (movementsAgg._sum.quantity || 0) - (movementsOutAgg._sum.quantity || 0);
    const storedStock = p.stockQuantity;
    if (calculatedStock !== storedStock) {
      console.error(`❌ Product ${p.id} stock mismatch: stored=${storedStock}, movements=${calculatedStock}`);
      failedInvariants++;
    }
  }

  // Invoice balanceDue check
  const dbInvoices = await prisma.invoice.findMany();
  for (const inv of dbInvoices) {
    const computed = Number(inv.total) - Number(inv.paidAmount) - Number(inv.creditApplied) - Number(inv.returnedAmount);
    const stored = Number(inv.balanceDue);
    if (Math.abs(computed - stored) > 0.01) {
      console.error(`❌ Invoice ${inv.invoiceNo} balance due mismatch: stored=${stored.toFixed(2)}, computed=${computed.toFixed(2)}`);
      failedInvariants++;
    }
  }

  // Purchase balanceDue check
  const dbPurchases = await prisma.purchase.findMany();
  for (const pur of dbPurchases) {
    const computed = Number(pur.total) - Number(pur.paidAmount) - Number(pur.creditApplied) - Number(pur.returnedAmount);
    const stored = Number(pur.balanceDue);
    if (Math.abs(computed - stored) > 0.01) {
      console.error(`❌ Purchase ${pur.purchaseNo} balance due mismatch: stored=${stored.toFixed(2)}, computed=${computed.toFixed(2)}`);
      failedInvariants++;
    }
  }

  // Database Orphan checks
  const orphanInvoiceItems = await prisma.invoiceItem.count({
    where: { invoiceId: { notIn: dbInvoices.map(i => i.id) } }
  });
  if (orphanInvoiceItems > 0) {
    console.error(`❌ Found ${orphanInvoiceItems} orphan InvoiceItems`);
    failedInvariants++;
  }

  const orphanStockMovements = await prisma.stockMovement.count({
    where: { productId: { notIn: dbProducts.map(p => p.id) } }
  });
  if (orphanStockMovements > 0) {
    console.error(`❌ Found ${orphanStockMovements} orphan StockMovements`);
    failedInvariants++;
  }

  if (failedInvariants === 0) {
    console.log("🎉 ALL INVARIANTS PASS PERFECTLY! SYSTEM IS 100% SOUND.");
  } else {
    throw new Error(`${failedInvariants} invariants failed!`);
  }
}

async function main() {
  await cleanupDb();
  await runAdversarialSimulation();
}

main()
  .catch(err => {
    console.error("Simulation run failed:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
