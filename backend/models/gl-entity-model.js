const prisma = require("../config/prisma");
const ledgerModel = require("./ledger-model");
const glModel = require("./gl-model");

/**
 * Creates a Customer Deposit (Prepayment).
 * Debit Cash (1000) / Credit Customer Deposits Liability (2100).
 * Posts a Credit entry to CustomerLedger.
 */
async function createCustomerDeposit({ customerId, amount, description, createdById }) {
  const depositAmount = Math.round(Number(amount) * 100) / 100;
  if (depositAmount <= 0) {
    const error = new Error("Deposit amount must be greater than zero.");
    error.statusCode = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const customers = await tx.$queryRaw`
      SELECT * FROM "Customer" 
      WHERE id = ${Number(customerId)} 
      FOR UPDATE
    `;
    const customer = customers[0];
    if (!customer) {
      const error = new Error("Customer not found.");
      error.statusCode = 404;
      throw error;
    }

    const deposit = await tx.customerDeposit.create({
      data: {
        customerId: Number(customerId),
        amount: depositAmount,
        appliedAmount: 0,
      },
    });

    // Customer Ledger credit (increases store credit / reduces what they owe us)
    await ledgerModel.recordCustomerLedgerEntry(
      {
        customerId: Number(customerId),
        debit: 0,
        credit: depositAmount,
        referenceType: "DEPOSIT",
        referenceId: deposit.id,
        description: description || `Customer Deposit #${deposit.id}`,
      },
      tx
    );

    // GL Journal Posting: Debit Cash (1000), Credit Customer Deposits Liability (2100)
    await glModel.postGLJournalEntries(
      [
        { code: "1000", debit: depositAmount, credit: 0, description: `Cash received for Customer Deposit #${deposit.id}` },
        { code: "2100", debit: 0, credit: depositAmount, description: `Customer Deposit Liability #${deposit.id}` },
      ],
      { referenceType: "DEPOSIT", referenceId: deposit.id, createdById },
      tx
    );

    return deposit;
  });
}

/**
 * Creates a standalone Credit Note (Customer Rebate / Adjustment).
 * Debit Sales Returns/Adjustments (4100) / Credit Accounts Receivable (1100).
 * Posts a Credit entry to CustomerLedger.
 */
async function createCreditNote({ customerId, invoiceId, amount, reason, createdById }) {
  const creditAmount = Math.round(Number(amount) * 100) / 100;
  if (creditAmount <= 0) {
    const error = new Error("Credit note amount must be greater than zero.");
    error.statusCode = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const customers = await tx.$queryRaw`
      SELECT * FROM "Customer" 
      WHERE id = ${Number(customerId)} 
      FOR UPDATE
    `;
    const customer = customers[0];
    if (!customer) {
      const error = new Error("Customer not found.");
      error.statusCode = 404;
      throw error;
    }

    const creditNote = await tx.creditNote.create({
      data: {
        customerId: Number(customerId),
        invoiceId: invoiceId ? Number(invoiceId) : null,
        amount: creditAmount,
        reason,
      },
    });

    await ledgerModel.recordCustomerLedgerEntry(
      {
        customerId: Number(customerId),
        debit: 0,
        credit: creditAmount,
        referenceType: "CORRECTION",
        referenceId: creditNote.id,
        description: reason || `Credit Note #${creditNote.id}`,
      },
      tx
    );

    // GL Journal Posting: Debit Sales Returns/Adjustments (4100), Credit Accounts Receivable (1100)
    await glModel.postGLJournalEntries(
      [
        { code: "4100", debit: creditAmount, credit: 0, description: `Credit Note #${creditNote.id} allowance` },
        { code: "1100", debit: 0, credit: creditAmount, description: `AR reduction for Credit Note #${creditNote.id}` },
      ],
      { referenceType: "CORRECTION", referenceId: creditNote.id, createdById },
      tx
    );

    return creditNote;
  });
}

/**
 * Creates a standalone Debit Note (Supplier Allowance / Claim).
 * Debit Accounts Payable (2000) / Credit Purchase Return Variance / Allowance (5100).
 * Posts a Debit entry to SupplierLedger.
 */
async function createDebitNote({ supplierId, purchaseId, amount, reason, createdById }) {
  const debitAmount = Math.round(Number(amount) * 100) / 100;
  if (debitAmount <= 0) {
    const error = new Error("Debit note amount must be greater than zero.");
    error.statusCode = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const suppliers = await tx.$queryRaw`
      SELECT * FROM "Supplier" 
      WHERE id = ${Number(supplierId)} 
      FOR UPDATE
    `;
    const supplier = suppliers[0];
    if (!supplier) {
      const error = new Error("Supplier not found.");
      error.statusCode = 404;
      throw error;
    }

    const debitNote = await tx.debitNote.create({
      data: {
        supplierId: Number(supplierId),
        purchaseId: purchaseId ? Number(purchaseId) : null,
        amount: debitAmount,
        reason,
      },
    });

    await ledgerModel.recordSupplierLedgerEntry(
      {
        supplierId: Number(supplierId),
        debit: debitAmount,
        credit: 0,
        referenceType: "CORRECTION",
        referenceId: debitNote.id,
        description: reason || `Debit Note #${debitNote.id}`,
      },
      tx
    );

    // GL Journal Posting: Debit Accounts Payable (2000), Credit Purchase Return Variance / Gain (5100)
    await glModel.postGLJournalEntries(
      [
        { code: "2000", debit: debitAmount, credit: 0, description: `AP reduction for Debit Note #${debitNote.id}` },
        { code: "5100", debit: 0, credit: debitAmount, description: `Supplier allowance claim Debit Note #${debitNote.id}` },
      ],
      { referenceType: "CORRECTION", referenceId: debitNote.id, createdById },
      tx
    );

    return debitNote;
  });
}

/**
 * Processes a Bad Debt Write-Off for an uncollectible invoice.
 * Debit Bad Debt Expense (6100) / Credit Accounts Receivable (1100).
 * Updates invoice documentStatus to VOIDED and records customer ledger credit to clear AR balance.
 */
async function createBadDebtWriteOff({ invoiceId, reason, createdById }) {
  if (!invoiceId) {
    const error = new Error("Invoice ID is required for bad debt write-off.");
    error.statusCode = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: Number(invoiceId) } });
    if (!invoice) {
      const error = new Error("Invoice not found.");
      error.statusCode = 404;
      throw error;
    }

    const writeOffAmount = Number(invoice.balanceDue);
    if (writeOffAmount <= 0) {
      const error = new Error("Invoice balance due is 0. Cannot write off an already settled invoice.");
      error.statusCode = 400;
      throw error;
    }

    const writeOff = await tx.badDebtWriteOff.create({
      data: {
        invoiceId: Number(invoiceId),
        amount: writeOffAmount,
        reason: reason || "Uncollectible debt write-off",
      },
    });

    if (invoice.customerId) {
      await ledgerModel.recordCustomerLedgerEntry(
        {
          customerId: invoice.customerId,
          debit: 0,
          credit: writeOffAmount,
          referenceType: "WRITE_OFF",
          referenceId: writeOff.id,
          description: `Bad Debt Write-Off for Invoice #${invoice.invoiceNo}: ${reason}`,
        },
        tx
      );
    }

    // GL Journal Posting: Debit Bad Debt Expense (6100), Credit Accounts Receivable (1100)
    await glModel.postGLJournalEntries(
      [
        { code: "6100", debit: writeOffAmount, credit: 0, description: `Bad Debt Expense for Invoice #${invoice.invoiceNo}` },
        { code: "1100", debit: 0, credit: writeOffAmount, description: `AR Write-Off for Invoice #${invoice.invoiceNo}` },
      ],
      { referenceType: "WRITE_OFF", referenceId: writeOff.id, createdById },
      tx
    );

    await tx.invoice.update({
      where: { id: Number(invoiceId) },
      data: {
        balanceDue: 0,
        status: "PAID",
        documentStatus: "VOIDED",
      },
    });

    return writeOff;
  });
}

function getCustomerDeposits(where = {}) {
  return prisma.customerDeposit.findMany({ where, orderBy: { createdAt: "desc" } });
}

function getCreditNotes(where = {}) {
  return prisma.creditNote.findMany({ where, orderBy: { createdAt: "desc" } });
}

function getDebitNotes(where = {}) {
  return prisma.debitNote.findMany({ where, orderBy: { createdAt: "desc" } });
}

function getBadDebtWriteOffs(where = {}) {
  return prisma.badDebtWriteOff.findMany({ where, orderBy: { createdAt: "desc" } });
}

module.exports = {
  createCustomerDeposit,
  createCreditNote,
  createDebitNote,
  createBadDebtWriteOff,
  getCustomerDeposits,
  getCreditNotes,
  getDebitNotes,
  getBadDebtWriteOffs,
};
