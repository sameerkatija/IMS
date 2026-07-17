const prisma = require("../config/prisma");

/**
 * Creates a business expense record.
 * Verifies that the expense category exists.
 */
async function createExpense({ categoryId, amount, expenseDate, description, createdById }) {
  const category = await prisma.expenseCategory.findUnique({
    where: { id: Number(categoryId) },
  });

  if (!category) {
    const error = new Error("Expense category not found.");
    error.statusCode = 404;
    throw error;
  }

  return prisma.expense.create({
    data: {
      categoryId: Number(categoryId),
      amount,
      expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
      description,
      createdById: Number(createdById),
    },
    include: {
      category: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
  });
}

/**
 * Lists expenses matching criteria, ordered by date descending.
 */
function listExpenses({ where, skip, take }) {
  return prisma.expense.findMany({
    where,
    skip,
    take,
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
    orderBy: {
      expenseDate: "desc",
    },
  });
}

/**
 * Counts total expenses matching criteria.
 */
function countExpenses(where) {
  return prisma.expense.count({ where });
}

/**
 * Retrieves a single business expense by its ID.
 */
function getExpenseById(id) {
  return prisma.expense.findUnique({
    where: { id: Number(id) },
    include: {
      category: {
        select: {
          id: true,
          name: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
  });
}

/**
 * Updates a business expense record.
 * Verifies that the expense category exists if updated.
 */
async function updateExpense(id, { categoryId, amount, expenseDate, description, createdById }) {
  if (categoryId) {
    const category = await prisma.expenseCategory.findUnique({
      where: { id: Number(categoryId) },
    });

    if (!category) {
      const error = new Error("Expense category not found.");
      error.statusCode = 404;
      throw error;
    }
  }

  return prisma.expense.update({
    where: { id: Number(id) },
    data: {
      categoryId: categoryId ? Number(categoryId) : undefined,
      amount: amount !== undefined ? amount : undefined,
      expenseDate: expenseDate ? new Date(expenseDate) : undefined,
      description: description !== undefined ? description : undefined,
      createdById: createdById ? Number(createdById) : undefined,
    },
    include: {
      category: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
  });
}

/**
 * Deletes a business expense by its ID.
 */
function deleteExpense(id) {
  return prisma.expense.delete({
    where: { id: Number(id) },
  });
}

module.exports = {
  createExpense,
  listExpenses,
  countExpenses,
  getExpenseById,
  updateExpense,
  deleteExpense,
};