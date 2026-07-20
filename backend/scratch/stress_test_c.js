require("dotenv").config();
const prisma = require("../config/prisma");
const paymentModel = require("../models/payment-model");
const ledgerModel = require("../models/ledger-model");

async function setupTestData() {
  console.log("Setting up multi-invoice stress test data...");

  // Clean up any leftovers from previous failed runs
  await prisma.paymentAllocation.deleteMany({});
  await prisma.customerPayment.deleteMany({});
  await prisma.customerLedger.deleteMany({});
  await prisma.invoiceItem.deleteMany({});
  await prisma.invoice.deleteMany({});
  await prisma.customer.deleteMany({ where: { name: "Stress Acme C" } });
  await prisma.product.deleteMany({ where: { sku: "TEST-STRESS-SKU-C" } });

  // Create test user
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        username: "testadmin",
        password: "secret",
        role: "ADMIN",
        name: "Test Admin",
      },
    });
  }

  // Create test salesman
  let salesman = await prisma.salesman.findFirst();
  if (!salesman) {
    salesman = await prisma.salesman.create({
      data: {
        name: "Test Salesman",
        phone: "12345678",
      },
    });
  }

  // Create category
  let category = await prisma.category.findFirst();
  if (!category) {
    category = await prisma.category.create({
      data: {
        name: "Test Category",
      },
    });
  }

  // Create product
  const product = await prisma.product.create({
    data: {
      name: "Stress Product C",
      sku: "TEST-STRESS-SKU-C",
      stockQuantity: 100000,
      costPrice: 50.00,
      sellingPrice: 100.00,
      categoryId: category.id,
    },
  });

  // Create customer
  const customer = await prisma.customer.create({
    data: {
      name: "Stress Acme C",
      phone: "03007777777",
      balance: 0.00,
    },
  });

  // Log large opening balance debit in ledger
  await ledgerModel.recordCustomerLedgerEntry({
    customerId: customer.id,
    debit: 100000.00,
    credit: 0,
    referenceType: "INVOICE",
    referenceId: 9999, // dummy
    description: "Opening Balance",
  });

  return { user, product, customer, salesman };
}

async function runTestC() {
  console.log("=== STARTING MULTI-INVOICE CONCURRENCY TEST (TEST C) ===");
  const { user, product, customer, salesman } = await setupTestData();

  try {
    // Create 3 separate invoices of 5,000 each
    const invoices = [];
    for (let i = 0; i < 3; i++) {
      const inv = await prisma.invoice.create({
        data: {
          invoiceNo: `INV-STRESS-C${i}`,
          customerId: customer.id,
          salesmanId: salesman.id,
          createdById: user.id,
          invoiceDate: new Date(),
          subtotal: 5000.00,
          discount: 0,
          total: 5000.00,
          paidAmount: 0,
          balanceDue: 5000.00,
          status: "UNPAID",
          items: {
            create: {
              productId: product.id,
              quantity: 50,
              unitPrice: 100.00,
              totalPrice: 5000.00,
              costPriceAtSale: 50.00,
            },
          },
        },
      });
      invoices.push(inv);
    }

    // Create general payment of 5,000
    const payment = await paymentModel.recordCustomerPayment({
      customerId: customer.id,
      amount: 5000.00,
      paymentDate: new Date(),
      description: "Payment C",
      createdById: user.id,
    });

    console.log(`Payment C created with total capacity: ${payment.amount}`);
    console.log(`Firing 3 concurrent allocation requests of 2,500 each to different invoices...`);

    // Fire allocations to Invoice C0, C1, C2 concurrently
    const promises = invoices.map(inv =>
      paymentModel.allocateCustomerPayment({
        customerPaymentId: payment.id,
        allocations: [{ invoiceId: inv.id, amountAllocated: 2500.00 }],
      })
    );

    const results = await Promise.allSettled(promises);
    const succeeded = results.filter(r => r.status === "fulfilled").length;
    const failed = results.filter(r => r.status === "rejected").length;

    console.log(`Results: Succeeded = ${succeeded}, Failed = ${failed}`);
    results.forEach((r, idx) => {
      if (r.status === "rejected") {
        console.log(`  - Reject ${idx + 1} reason: ${r.reason.message}`);
      } else {
        console.log(`  - Success ${idx + 1}`);
      }
    });

    // DB Verification - Query allocations directly
    const allocationsInDB = await prisma.paymentAllocation.findMany({
      where: { customerPaymentId: payment.id },
    });
    console.log(`Querying DB: PaymentAllocation rows found = ${allocationsInDB.length}`);
    const allocatedSum = allocationsInDB.reduce((sum, a) => sum + Number(a.amountAllocated), 0);
    console.log(`Querying DB: Sum of allocated amount = ${allocatedSum}`);

    // Assertions
    if (succeeded !== 2 || failed !== 1) {
      throw new Error(`TEST C FAIL: Expected 2 successes and 1 failure, got ${succeeded} and ${failed}`);
    }
    if (allocationsInDB.length !== 2) {
      throw new Error(`TEST C FAIL: Expected exactly 2 allocation rows, got ${allocationsInDB.length}`);
    }
    if (allocatedSum !== 5000) {
      throw new Error(`TEST C FAIL: Expected allocated sum in DB to be exactly 5,000, got ${allocatedSum}`);
    }

    console.log("✓ Test C Concurrency verification passed: exactly 2 allocations succeeded, exactly 2 separate PaymentAllocation rows created, 0 deadlocks.");

  } catch (error) {
    console.error("\n❌ TEST C CONCURRENCY TEST FAILED:", error);
    process.exit(1);
  } finally {
    // CLEAN UP TEST DATA
    console.log("\nCleaning up test data...");
    await prisma.paymentAllocation.deleteMany({});
    await prisma.customerPayment.deleteMany({});
    await prisma.customerLedger.deleteMany({});
    await prisma.invoiceItem.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.customer.deleteMany({});
    await prisma.product.deleteMany({});
    console.log("Cleanup complete.");
  }

  console.log("\n=== TEST C CONCURRENCY LOAD TESTS PASSED SUCCESSFULLY ===");
  process.exit(0);
}

runTestC();
