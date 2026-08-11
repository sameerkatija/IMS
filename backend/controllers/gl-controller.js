const glModel = require("../models/gl-model");
const glEntityModel = require("../models/gl-entity-model");

async function getTrialBalance(req, res, next) {
  try {
    const { from, to } = req.query;
    const result = await glModel.getGLTrialBalance({ from, to });
    res.status(200).json({ type: "success", data: result, message: "Trial balance fetched successfully." });
  } catch (error) {
    next(error);
  }
}

async function getProfitAndLoss(req, res, next) {
  try {
    const { from, to } = req.query;
    const result = await glModel.getGLProfitAndLoss({ from, to });
    res.status(200).json({ type: "success", data: result, message: "General Ledger P&L fetched successfully." });
  } catch (error) {
    next(error);
  }
}

async function getJournalEntries(req, res, next) {
  try {
    const { from, to, accountId, referenceType, referenceId, page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const result = await glModel.getGLJournalEntries({
      from,
      to,
      accountId,
      referenceType,
      referenceId,
      skip,
      take: limit,
    });
    res.status(200).json({ type: "success", data: result, message: "GL journal entries fetched successfully." });
  } catch (error) {
    next(error);
  }
}

async function createCustomerDeposit(req, res, next) {
  try {
    const { customerId, amount, description } = req.body;
    const createdById = req.user?.id || 1;
    const result = await glEntityModel.createCustomerDeposit({ customerId, amount, description, createdById });
    res.status(201).json({ type: "success", data: result, message: "Customer deposit created successfully." });
  } catch (error) {
    next(error);
  }
}

async function getCustomerDeposits(req, res, next) {
  try {
    const result = await glEntityModel.getCustomerDeposits();
    res.status(200).json({ type: "success", data: result, message: "Customer deposits fetched successfully." });
  } catch (error) {
    next(error);
  }
}

async function createCreditNote(req, res, next) {
  try {
    const { customerId, invoiceId, amount, reason } = req.body;
    const createdById = req.user?.id || 1;
    const result = await glEntityModel.createCreditNote({ customerId, invoiceId, amount, reason, createdById });
    res.status(201).json({ type: "success", data: result, message: "Credit note issued successfully." });
  } catch (error) {
    next(error);
  }
}

async function getCreditNotes(req, res, next) {
  try {
    const result = await glEntityModel.getCreditNotes();
    res.status(200).json({ type: "success", data: result, message: "Credit notes fetched successfully." });
  } catch (error) {
    next(error);
  }
}

async function createDebitNote(req, res, next) {
  try {
    const { supplierId, purchaseId, amount, reason } = req.body;
    const createdById = req.user?.id || 1;
    const result = await glEntityModel.createDebitNote({ supplierId, purchaseId, amount, reason, createdById });
    res.status(201).json({ type: "success", data: result, message: "Debit note issued successfully." });
  } catch (error) {
    next(error);
  }
}

async function getDebitNotes(req, res, next) {
  try {
    const result = await glEntityModel.getDebitNotes();
    res.status(200).json({ type: "success", data: result, message: "Debit notes fetched successfully." });
  } catch (error) {
    next(error);
  }
}

async function createBadDebtWriteOff(req, res, next) {
  try {
    const { invoiceId, reason } = req.body;
    const createdById = req.user?.id || 1;
    const result = await glEntityModel.createBadDebtWriteOff({ invoiceId, reason, createdById });
    res.status(201).json({ type: "success", data: result, message: "Bad debt written off successfully." });
  } catch (error) {
    next(error);
  }
}

async function getBadDebtWriteOffs(req, res, next) {
  try {
    const result = await glEntityModel.getBadDebtWriteOffs();
    res.status(200).json({ type: "success", data: result, message: "Bad debt write-offs fetched successfully." });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getTrialBalance,
  getProfitAndLoss,
  getJournalEntries,
  createCustomerDeposit,
  getCustomerDeposits,
  createCreditNote,
  getCreditNotes,
  createDebitNote,
  getDebitNotes,
  createBadDebtWriteOff,
  getBadDebtWriteOffs,
};
