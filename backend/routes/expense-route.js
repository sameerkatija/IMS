const express = require("express");
const router = express.Router();
const expenseController = require("../controllers/expense-controller");
const validate = require("../middlewares/zod-schema-validator");
const authorizeRole = require("../middlewares/authorize-role");
const { createExpenseSchema, updateExpenseSchema } = require("../config/zod-schema");

// Record business expense (ADMIN only)
router.post("/", authorizeRole("ADMIN"), validate(createExpenseSchema), expenseController.createExpense);

// Get list of expenses
router.get("/", expenseController.listExpenses);

// Get expense by ID
router.get("/:id", expenseController.getExpenseById);

// Update expense by ID (ADMIN only)
router.put("/:id", authorizeRole("ADMIN"), validate(updateExpenseSchema), expenseController.updateExpense);

// Delete expense by ID (ADMIN only)
router.delete("/:id", authorizeRole("ADMIN"), expenseController.deleteExpense);

module.exports = router;
