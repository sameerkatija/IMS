const prisma = require("../config/prisma");
const glModel = require("./gl-model");
const systemModel = require("./system-model");

/**
 * Creates a business expense record atomically and posts to GL.
 * Verifies that the expense category exists.
 */
async function createExpense({ categoryId, amount, expenseDate, description, createdById }) {
  return prisma.$transaction(async (tx) => {
    const targetDate = expenseDate ? new Date(expenseDate) : new Date();
    await systemModel.verifyPeriodNotClosed(targetDate, tx);

    const category = await tx.expenseCategory.findUnique({
      where: { id: Number(categoryId) },
    });

    if (!category) {
      const error = new Error("Expense category not found.");
      error.statusCode = 404;
      throw error;
    }

    const expense = await tx.expense.create({
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

    // Post GL Journal Entries: Debit Operating Expenses (6000), Credit Cash (1000)
    // HIGH-06 FIX: Use referenceType "EXPENSE" (not "PAYMENT") to avoid collision with
    // supplier payment GL entries that share the same integer referenceId namespace.
    const expAmount = Math.round(Number(amount) * 100) / 100;
    await glModel.postGLJournalEntries(
      [
        { code: "6000", debit: expAmount, credit: 0, description: `Expense: ${category.name} - ${description || ""}` },
        { code: "1000", debit: 0, credit: expAmount, description: `Cash paid for Expense #${expense.id}` },
      ],
      { referenceType: "EXPENSE", referenceId: expense.id, createdById, entryDate: expense.expenseDate },
      tx
    );

    return expense;
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
 * Updates a business expense record and updates GL journal entries.
 */
async function updateExpense(id, { categoryId, amount, expenseDate, description, createdById }) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findUnique({
      where: { id: Number(id) },
      include: { category: true }
    });
    if (!existing) {
      const error = new Error("Expense not found.");
      error.statusCode = 404;
      throw error;
    }

    await systemModel.verifyPeriodNotClosed(existing.expenseDate, tx);
    if (expenseDate) {
      await systemModel.verifyPeriodNotClosed(expenseDate, tx);
    }

    let targetCat = existing.category;
    if (categoryId && Number(categoryId) !== existing.categoryId) {
      targetCat = await tx.expenseCategory.findUnique({
        where: { id: Number(categoryId) },
      });
      if (!targetCat) {
        const error = new Error("Expense category not found.");
        error.statusCode = 404;
        throw error;
      }
    }

    const updated = await tx.expense.update({
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

    // Delete existing GL entries for this expense reference and re-post updated entries.
    // HIGH-06 FIX: The WHERE clause now uses referenceType "EXPENSE" to scope the delete
    // exclusively to expense entries. Using "PAYMENT" previously risked deleting supplier
    // payment GL entries if they happened to share the same integer referenceId.
    await tx.gLJournalEntry.deleteMany({
      where: { referenceType: "EXPENSE", referenceId: Number(id) },
    });

    const expAmount = Math.round(Number(updated.amount) * 100) / 100;
    await glModel.postGLJournalEntries(
      [
        { code: "6000", debit: expAmount, credit: 0, description: `Expense: ${targetCat.name} - ${updated.description || ""}` },
        { code: "1000", debit: 0, credit: expAmount, description: `Cash paid for Expense #${updated.id}` },
      ],
      { referenceType: "EXPENSE", referenceId: updated.id, createdById: createdById || updated.createdById, entryDate: updated.expenseDate },
      tx
    );

    return updated;
  });
}

/**
 * Deletes a business expense by its ID and cleans up GL journal entries.
 */
async function deleteExpense(id) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.expense.findUnique({ where: { id: Number(id) } });
    if (!existing) {
      const error = new Error("Expense not found.");
      error.statusCode = 404;
      throw error;
    }

    await systemModel.verifyPeriodNotClosed(existing.expenseDate, tx);

    // HIGH-06 FIX: Delete GL entries scoped to "EXPENSE" referenceType only
    await tx.gLJournalEntry.deleteMany({
      where: { referenceType: "EXPENSE", referenceId: Number(id) },
    });

    return tx.expense.delete({
      where: { id: Number(id) },
    });
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