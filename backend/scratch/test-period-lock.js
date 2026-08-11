require("dotenv").config({ path: "backend/.env" });
const prisma = require("../config/prisma");
const systemModel = require("../models/system-model");
const expenseModel = require("../models/expense-model");

async function testPeriodLocking() {
  console.log("--- Starting Accounting Period Lock Verification ---");
  try {
    // 1. Create a closed period for July 2026
    const period = await systemModel.createAccountingPeriod({
      name: "July 2026 Test Closed Period",
      startDate: "2026-07-01T00:00:00.000Z",
      endDate: "2026-07-31T23:59:59.999Z",
    });
    console.log(`[PASS] Created test accounting period '${period.name}' (ID: ${period.id})`);

    // Lock period
    await systemModel.lockAccountingPeriod(period.id, 1);
    console.log(`[PASS] Locked accounting period ID ${period.id}`);

    // 2. Attempt to create an expense dated July 15, 2026 inside closed period
    try {
      await expenseModel.createExpense({
        categoryId: 1,
        amount: 500,
        expenseDate: "2026-07-15T12:00:00.000Z",
        description: "Test Expense in Closed Period",
        createdById: 1,
      });
      console.error("[FAIL] Error: Transaction in closed period was NOT blocked!");
    } catch (err) {
      if (err.statusCode === 400 && err.message.includes("closed")) {
        console.log(`[PASS] Period Lock Guard working! Caught expected HTTP 400 Error: "${err.message}"`);
      } else {
        console.error(`[FAIL] Unexpected error:`, err);
      }
    }

    // 3. Clean up test period
    await prisma.accountingPeriod.delete({ where: { id: period.id } });
    console.log(`[PASS] Cleaned up test accounting period.`);
    console.log("--- Accounting Period Lock Verification Complete: SUCCESS ---");
  } catch (error) {
    console.error("Test execution failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testPeriodLocking();
