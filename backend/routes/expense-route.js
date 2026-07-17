const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/expense-controller");
const validate = require("../middlewares/zod-schema-validator");
const { createExpenseSchema, updateExpenseSchema } = require("../config/zod-schema");

// Record business expense
router.post("/", validate(createExpenseSchema), expenseController.createExpense);

// Get list of expenses
router.get("/", expenseController.listExpenses);

// Get expense by ID
router.get("/:id", expenseController.getExpenseById);

// Update expense by ID
router.put("/:id", validate(updateExpenseSchema), expenseController.updateExpense);

// Delete expense by ID
router.delete("/:id", expenseController.deleteExpense);

module.exports = router;
