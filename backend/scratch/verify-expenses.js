// Load environment variables from the backend .env file
require("dotenv").config({ path: "c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/.env" });

const prisma = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/config/prisma");
const expenseModel = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/models/expense-model");
const expenseController = require("c:/Users/SameerKatija/Documents/code/SameerTraderzFullStack/backend/controllers/expense-controller");

async function main() {
  console.log("=== Expense Feature Verification ===");

  // 1. Setup test user
  let user = await prisma.user.findFirst();
  if (!user) {
    console.log("Creating test user...");
    user = await prisma.user.create({
      data: {
        name: "Test User",
        username: "testuser",
        password: "password123",
        role: "ADMIN"
      }
    });
  }
  const userId = user.id;

  // 2. Setup test expense category
  let category = await prisma.expenseCategory.findFirst();
  if (!category) {
    console.log("Creating test expense category...");
    category = await prisma.expenseCategory.create({
      data: { name: "Test Category" }
    });
  }
  const categoryId = category.id;

  console.log(`Using User ID: ${userId}, Category ID: ${categoryId}`);

  // ============================================
  // MODEL TESTS
  // ============================================
  console.log("\n--- Model Tests ---");

  // Create
  console.log("Testing model.createExpense...");
  const expense = await expenseModel.createExpense({
    categoryId,
    amount: 150.50,
    expenseDate: new Date(),
    description: "Model Test Expense",
    createdById: userId
  });
  console.log(`Created Expense ID: ${expense.id}`);

  // Get by ID
  console.log("Testing model.getExpenseById...");
  const fetched = await expenseModel.getExpenseById(expense.id);
  console.log(`Fetched Description: ${fetched.description}, Amount: ${fetched.amount}`);
  if (!fetched || fetched.description !== "Model Test Expense" || Number(fetched.amount) !== 150.50) {
    throw new Error("model.getExpenseById verification failed");
  }

  // Update
  console.log("Testing model.updateExpense...");
  const updated = await expenseModel.updateExpense(expense.id, {
    categoryId,
    amount: 200.00,
    description: "Model Test Expense Updated",
    createdById: userId
  });
  console.log(`Updated Description: ${updated.description}, Amount: ${updated.amount}`);
  if (updated.description !== "Model Test Expense Updated" || Number(updated.amount) !== 200.00) {
    throw new Error("model.updateExpense verification failed");
  }

  // Delete
  console.log("Testing model.deleteExpense...");
  await expenseModel.deleteExpense(expense.id);
  const deletedCheck = await expenseModel.getExpenseById(expense.id);
  if (deletedCheck) {
    throw new Error("model.deleteExpense verification failed (still exists)");
  }
  console.log("Model deletion verified successfully.");

  // ============================================
  // CONTROLLER TESTS
  // ============================================
  console.log("\n--- Controller Tests ---");

  // Setup helper for mock res
  function createMockResponse() {
    const res = {
      statusCode: 200,
      jsonPayload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonPayload = data;
        return this;
      }
    };
    return res;
  }

  // Let's create an expense to use in controller tests
  const ctrlTestExpense = await expenseModel.createExpense({
    categoryId,
    amount: 50.00,
    expenseDate: new Date(),
    description: "Controller Test Expense",
    createdById: userId
  });
  const ctrlExpenseId = ctrlTestExpense.id;
  console.log(`Created temp expense ID ${ctrlExpenseId} for controller testing.`);

  // Test: getExpenseById controller
  console.log("Testing controller.getExpenseById (Valid ID)...");
  let req = { params: { id: ctrlExpenseId } };
  let res = createMockResponse();
  await expenseController.getExpenseById(req, res);
  console.log(`Response Code: ${res.statusCode}, Type: ${res.jsonPayload.type}`);
  if (res.statusCode !== 200 || res.jsonPayload.type !== "success" || res.jsonPayload.data.id !== ctrlExpenseId) {
    throw new Error("controller.getExpenseById success test failed");
  }

  console.log("Testing controller.getExpenseById (Invalid ID)...");
  req = { params: { id: "abc" } };
  res = createMockResponse();
  await expenseController.getExpenseById(req, res);
  console.log(`Response Code: ${res.statusCode}, Message: ${res.jsonPayload.message}`);
  if (res.statusCode !== 400 || res.jsonPayload.type !== "error") {
    throw new Error("controller.getExpenseById invalid ID test failed");
  }

  console.log("Testing controller.getExpenseById (Non-existent ID)...");
  req = { params: { id: 999999 } };
  res = createMockResponse();
  await expenseController.getExpenseById(req, res);
  console.log(`Response Code: ${res.statusCode}, Message: ${res.jsonPayload.message}`);
  if (res.statusCode !== 404 || res.jsonPayload.type !== "error") {
    throw new Error("controller.getExpenseById non-existent ID test failed");
  }

  // Test: updateExpense controller
  console.log("Testing controller.updateExpense (Valid)...");
  req = {
    params: { id: ctrlExpenseId },
    body: {
      categoryId,
      amount: 99.99,
      description: "Controller Updated Description"
    },
    user: { id: userId }
  };
  res = createMockResponse();
  await expenseController.updateExpense(req, res);
  console.log(`Response Code: ${res.statusCode}, Message: ${res.jsonPayload.message}`);
  if (res.statusCode !== 200 || Number(res.jsonPayload.data.amount) !== 99.99) {
    throw new Error("controller.updateExpense test failed");
  }

  // Test: deleteExpense controller
  console.log("Testing controller.deleteExpense...");
  req = { params: { id: ctrlExpenseId } };
  res = createMockResponse();
  await expenseController.deleteExpense(req, res);
  console.log(`Response Code: ${res.statusCode}, Message: ${res.jsonPayload.message}`);
  if (res.statusCode !== 200) {
    throw new Error("controller.deleteExpense test failed");
  }

  // Verify it is gone
  const finalCheck = await expenseModel.getExpenseById(ctrlExpenseId);
  if (finalCheck) {
    throw new Error("Controller delete verified but expense still in DB");
  }

  console.log("\n=== ALL TESTS PASSED SUCCESSFULLY ===");
}

main()
  .catch((err) => {
    console.error("Verification failed with error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
