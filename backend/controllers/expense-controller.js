const expenseModel = require("../models/expense-model");

/**
 * Handles recording of a new business expense.
 */
async function createExpense(req, res) {
  try {
    const { categoryId, amount, expenseDate, description } = req.body;
    const createdById = req.user.id;

    const expense = await expenseModel.createExpense({
      categoryId,
      amount,
      expenseDate,
      description,
      createdById,
    });

    return res.status(201).json({
      type: "success",
      message: "Expense recorded successfully",
      data: expense,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to record expense.",
    });
  }
}

/**
 * Lists expenses with pagination and optional filters.
 */
async function listExpenses(req, res) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;

    const where = {};

    if (req.query.categoryId) {
      where.categoryId = Number(req.query.categoryId);
    }

    if (req.query.from || req.query.to) {
      where.expenseDate = {};
      if (req.query.from) {
        where.expenseDate.gte = new Date(req.query.from);
      }
      if (req.query.to) {
        where.expenseDate.lte = new Date(req.query.to);
      }
    }

    const [expenses, total] = await Promise.all([
      expenseModel.listExpenses({ where, skip, take: limit }),
      expenseModel.countExpenses(where),
    ]);

    return res.status(200).json({
      type: "success",
      data: expenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to retrieve expenses.",
    });
  }
}

/**
 * Retrieves a single expense by its ID.
 */
async function getExpenseById(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        type: "error",
        message: "Invalid expense ID.",
      });
    }

    const expense = await expenseModel.getExpenseById(id);
    if (!expense) {
      return res.status(404).json({
        type: "error",
        message: "Expense not found.",
      });
    }

    return res.status(200).json({
      type: "success",
      message: "Expense fetched successfully",
      data: expense,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to retrieve expense.",
    });
  }
}

/**
 * Updates an expense by its ID.
 */
async function updateExpense(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        type: "error",
        message: "Invalid expense ID.",
      });
    }

    const existingExpense = await expenseModel.getExpenseById(id);
    if (!existingExpense) {
      return res.status(404).json({
        type: "error",
        message: "Expense not found.",
      });
    }

    const { categoryId, amount, expenseDate, description } = req.body;
    const createdById = req.user.id;

    const expense = await expenseModel.updateExpense(id, {
      categoryId,
      amount,
      expenseDate,
      description,
      createdById,
    });

    return res.status(200).json({
      type: "success",
      message: "Expense updated successfully",
      data: expense,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to update expense.",
    });
  }
}

/**
 * Deletes an expense by its ID.
 */
async function deleteExpense(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        type: "error",
        message: "Invalid expense ID.",
      });
    }

    const existingExpense = await expenseModel.getExpenseById(id);
    if (!existingExpense) {
      return res.status(404).json({
        type: "error",
        message: "Expense not found.",
      });
    }

    await expenseModel.deleteExpense(id);

    return res.status(200).json({
      type: "success",
      message: "Expense deleted successfully.",
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to delete expense.",
    });
  }
}

module.exports = {
  createExpense,
  listExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
};