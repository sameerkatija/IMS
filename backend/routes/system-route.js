const express = require("express");
const router = express.Router();
const systemController = require("../controllers/system-controller");
const authorizeRole = require("../middlewares/authorize-role");

// Download Database Backup (ADMIN only)
router.get("/backup", authorizeRole("ADMIN"), systemController.downloadBackup);

// Accounting Period Lock Management (ADMIN only)
router.post("/accounting-periods", authorizeRole("ADMIN"), systemController.createAccountingPeriod);
router.put("/accounting-periods/:id/lock", authorizeRole("ADMIN"), systemController.lockAccountingPeriod);
router.put("/accounting-periods/:id/unlock", authorizeRole("ADMIN"), systemController.unlockAccountingPeriod);
router.get("/accounting-periods", systemController.listAccountingPeriods);

module.exports = router;
