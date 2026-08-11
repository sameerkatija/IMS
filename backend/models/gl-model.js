const prisma = require("../config/prisma");
const systemModel = require("./system-model");

/**
 * Maps standard GL account codes to their database IDs.
 */
async function getGLAccountMap(tx = prisma) {
  const accounts = await tx.gLAccount.findMany();
  const map = {};
  for (const acc of accounts) {
    map[acc.code] = acc.id;
  }
  return map;
}

/**
 * Writes double-entry GL journal entries atomically inside a transaction.
 * @param {Array<{code: string, debit: number, credit: number, description: string}>} entries
 * @param {Object} param1 - metadata
 * @param {Object} tx - Prisma transaction client
 */
async function postGLJournalEntries(entries, { referenceType, referenceId, createdById, entryDate }, tx = prisma) {
  if (!entries || entries.length === 0) return;

  const postingDate = entryDate ? new Date(entryDate) : new Date();
  await systemModel.verifyPeriodNotClosed(postingDate, tx);

  const accountMap = await getGLAccountMap(tx);

  for (const entry of entries) {
    const accountId = accountMap[entry.code];
    if (!accountId) {
      throw new Error(`GL Account with code ${entry.code} not found. Please ensure GL accounts are seeded.`);
    }

    const debit = Math.max(0, Math.round(Number(entry.debit || 0) * 100) / 100);
    const credit = Math.max(0, Math.round(Number(entry.credit || 0) * 100) / 100);

    if (debit === 0 && credit === 0) continue;

    await tx.gLJournalEntry.create({
      data: {
        entryDate: postingDate,
        accountId,
        debit,
        credit,
        referenceType,
        referenceId: Number(referenceId),
        description: entry.description || `GL Entry for ${referenceType} #${referenceId}`,
        // CQ-03 FIX: Warn loudly if createdById is missing rather than silently attributing
        // all untracked GL entries to user ID 1 (which masks who posted what in the audit trail).
        createdById: createdById
          ? Number(createdById)
          : (() => {
              console.warn(
                `[GL AUDIT WARNING] postGLJournalEntries called without createdById ` +
                `for ${referenceType}#${referenceId}. Entry attributed to user ID 1.`
              );
              return 1;
            })(),
      },
    });
  }
}

/**
 * Returns trial balance for Chart of Accounts.
 */
async function getGLTrialBalance({ from, to }) {
  const where = {};
  if (from || to) {
    where.entryDate = {};
    if (from) where.entryDate.gte = new Date(from);
    if (to) where.entryDate.lte = new Date(to);
  }

  const accounts = await prisma.gLAccount.findMany({
    include: {
      entries: {
        where,
        select: {
          debit: true,
          credit: true,
        },
      },
    },
    orderBy: { code: "asc" },
  });

  let totalDebit = 0;
  let totalCredit = 0;

  const list = accounts.map((acc) => {
    let debitSum = 0;
    let creditSum = 0;
    for (const e of acc.entries) {
      debitSum += Number(e.debit);
      creditSum += Number(e.credit);
    }

    totalDebit += debitSum;
    totalCredit += creditSum;

    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      totalDebit: Math.round(debitSum * 100) / 100,
      totalCredit: Math.round(creditSum * 100) / 100,
      netBalance: Math.round((debitSum - creditSum) * 100) / 100,
    };
  });

  return {
    accounts: list,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
  };
}

/**
 * Computes immutable P&L directly from posted GL journal entries.
 */
async function getGLProfitAndLoss({ from, to }) {
  const where = {};
  if (from || to) {
    where.entryDate = {};
    if (from) where.entryDate.gte = new Date(from);
    if (to) where.entryDate.lte = new Date(to);
  }

  const accounts = await prisma.gLAccount.findMany({
    include: {
      entries: {
        where,
        select: {
          debit: true,
          credit: true,
        },
      },
    },
  });

  const accSums = {};
  for (const acc of accounts) {
    let debit = 0;
    let credit = 0;
    for (const e of acc.entries) {
      debit += Number(e.debit);
      credit += Number(e.credit);
    }
    accSums[acc.code] = { debit, credit, netCredit: credit - debit, netDebit: debit - credit };
  }

  // 4000 Sales Revenue (Credit - Debit)
  const salesRevenue = Math.round((accSums["4000"]?.netCredit || 0) * 100) / 100;
  // 4100 Sales Returns (Debit - Credit)
  const salesReturns = Math.round((accSums["4100"]?.netDebit || 0) * 100) / 100;
  const netSales = Math.round((salesRevenue - salesReturns) * 100) / 100;

  // 5000 COGS (Debit - Credit)
  const cogs = Math.round((accSums["5000"]?.netDebit || 0) * 100) / 100;

  // 5100 Purchase Return Variance (Net credit is gain, net debit is loss)
  const purchaseReturnVariance = Math.round(((accSums["5100"]?.credit || 0) - (accSums["5100"]?.debit || 0)) * 100) / 100;

  const grossProfit = Math.round((netSales - cogs + purchaseReturnVariance) * 100) / 100;

  // 6000 Operating Expenses (Debit - Credit)
  const operatingExpenses = Math.round((accSums["6000"]?.netDebit || 0) * 100) / 100;
  // 6100 Bad Debt Expense (Debit - Credit)
  const badDebtExpense = Math.round((accSums["6100"]?.netDebit || 0) * 100) / 100;
  // 5200 Inventory Shrinkage (Debit - Credit)
  const inventoryShrinkage = Math.round((accSums["5200"]?.netDebit || 0) * 100) / 100;

  const totalExpenses = Math.round((operatingExpenses + badDebtExpense + inventoryShrinkage) * 100) / 100;
  const netProfit = Math.round((grossProfit - totalExpenses) * 100) / 100;

  return {
    salesRevenue,
    salesReturns,
    netSales,
    cogs,
    purchaseReturnVariance,
    grossProfit,
    operatingExpenses,
    badDebtExpense,
    inventoryShrinkage,
    totalExpenses,
    netProfit,
  };
}

/**
 * Returns paginated GL journal entries.
 */
async function getGLJournalEntries({ from, to, accountId, referenceType, referenceId, skip = 0, take = 50 }) {
  const where = {};
  if (from || to) {
    where.entryDate = {};
    if (from) where.entryDate.gte = new Date(from);
    if (to) where.entryDate.lte = new Date(to);
  }
  if (accountId) where.accountId = Number(accountId);
  if (referenceType) where.referenceType = referenceType;
  if (referenceId) where.referenceId = Number(referenceId);

  const [total, entries] = await Promise.all([
    prisma.gLJournalEntry.count({ where }),
    prisma.gLJournalEntry.findMany({
      where,
      skip: Number(skip),
      take: Number(take),
      include: {
        account: { select: { code: true, name: true, type: true } },
      },
      orderBy: { entryDate: "desc" },
    }),
  ]);

  return { total, entries };
}

module.exports = {
  getGLAccountMap,
  postGLJournalEntries,
  getGLTrialBalance,
  getGLProfitAndLoss,
  getGLJournalEntries,
};
