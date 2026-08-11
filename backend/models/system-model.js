const prisma = require("../config/prisma");

/**
 * Verifies that a transaction date does not fall within a closed/locked accounting period.
 * Throws a 400 Bad Request error if the period is locked.
 */
async function verifyPeriodNotClosed(date, txClient) {
  const tx = txClient || prisma;
  const targetDate = date ? new Date(date) : new Date();

  // Find any closed accounting period that encompasses the target date
  const closedPeriod = await tx.accountingPeriod.findFirst({
    where: {
      isClosed: true,
      startDate: { lte: targetDate },
      endDate: { gte: targetDate },
    },
  });

  if (closedPeriod) {
    const formattedDate = targetDate.toISOString().split("T")[0];
    const error = new Error(
      `Accounting period '${closedPeriod.name}' covering date ${formattedDate} is closed. No transactions or alterations are allowed.`
    );
    error.statusCode = 400;
    throw error;
  }
}

/**
 * Creates a new accounting period.
 */
async function createAccountingPeriod({ name, startDate, endDate }) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    const error = new Error("Invalid start or end date.");
    error.statusCode = 400;
    throw error;
  }

  if (start >= end) {
    const error = new Error("Start date must be strictly before end date.");
    error.statusCode = 400;
    throw error;
  }

  return prisma.accountingPeriod.create({
    data: {
      name,
      startDate: start,
      endDate: end,
      isClosed: false,
    },
  });
}

/**
 * Locks/closes an accounting period.
 */
async function lockAccountingPeriod(id, closedById) {
  const period = await prisma.accountingPeriod.findUnique({
    where: { id: Number(id) },
  });

  if (!period) {
    const error = new Error("Accounting period not found.");
    error.statusCode = 404;
    throw error;
  }

  return prisma.accountingPeriod.update({
    where: { id: Number(id) },
    data: {
      isClosed: true,
      closedAt: new Date(),
      closedById: closedById ? Number(closedById) : undefined,
    },
  });
}

/**
 * Unlocks/re-opens an accounting period (Admin override).
 */
async function unlockAccountingPeriod(id) {
  const period = await prisma.accountingPeriod.findUnique({
    where: { id: Number(id) },
  });

  if (!period) {
    const error = new Error("Accounting period not found.");
    error.statusCode = 404;
    throw error;
  }

  return prisma.accountingPeriod.update({
    where: { id: Number(id) },
    data: {
      isClosed: false,
      closedAt: null,
      closedById: null,
    },
  });
}

/**
 * Lists all accounting periods, ordered by startDate desc.
 */
async function listAccountingPeriods() {
  return prisma.accountingPeriod.findMany({
    orderBy: { startDate: "desc" },
  });
}

module.exports = {
  verifyPeriodNotClosed,
  createAccountingPeriod,
  lockAccountingPeriod,
  unlockAccountingPeriod,
  listAccountingPeriods,
};
