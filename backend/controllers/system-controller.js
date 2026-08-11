const systemModel = require("../models/system-model");
const { generateBackup } = require("../config/backup-db");
const fs = require("fs");
const path = require("path");

async function createAccountingPeriod(req, res, next) {
  try {
    const { name, startDate, endDate } = req.body;
    if (!name || !startDate || !endDate) {
      return res.status(400).json({ error: "name, startDate, and endDate are required." });
    }
    const period = await systemModel.createAccountingPeriod({ name, startDate, endDate });
    return res.status(201).json({ message: "Accounting period created successfully.", period });
  } catch (error) {
    next(error);
  }
}

async function lockAccountingPeriod(req, res, next) {
  try {
    const { id } = req.params;
    const closedById = req.user ? req.user.id : null;
    const period = await systemModel.lockAccountingPeriod(id, closedById);
    return res.status(200).json({ message: `Accounting period '${period.name}' locked successfully.`, period });
  } catch (error) {
    next(error);
  }
}

async function unlockAccountingPeriod(req, res, next) {
  try {
    const { id } = req.params;
    const period = await systemModel.unlockAccountingPeriod(id);
    return res.status(200).json({ message: `Accounting period '${period.name}' unlocked successfully.`, period });
  } catch (error) {
    next(error);
  }
}

async function listAccountingPeriods(req, res, next) {
  try {
    const periods = await systemModel.listAccountingPeriods();
    return res.status(200).json({ periods });
  } catch (error) {
    next(error);
  }
}

async function downloadBackup(req, res, next) {
  try {
    const sql = await generateBackup();
    const backupDir = path.join(__dirname, "../backups");
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `backup-${timestamp}.sql`;
    const filePath = path.join(backupDir, filename);
    fs.writeFileSync(filePath, sql, "utf8");

    res.setHeader("Content-Type", "application/sql");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.status(200).send(sql);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createAccountingPeriod,
  lockAccountingPeriod,
  unlockAccountingPeriod,
  listAccountingPeriods,
  downloadBackup,
};
