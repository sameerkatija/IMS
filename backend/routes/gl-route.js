const express = require("express");
const router = express.Router();
const glController = require("../controllers/gl-controller");
const authenticateToken = require("../middlewares/jwt-token-validator");
const authorizeRole = require("../middlewares/authorize-role");

router.use(authenticateToken);

// GL Reports (ADMIN only)
router.get("/trial-balance", authorizeRole("ADMIN"), glController.getTrialBalance);
router.get("/profit-loss", authorizeRole("ADMIN"), glController.getProfitAndLoss);
router.get("/journal-entries", authorizeRole("ADMIN"), glController.getJournalEntries);

// Customer Deposits
router.post("/customer-deposit", authorizeRole("ADMIN"), glController.createCustomerDeposit);
router.get("/customer-deposit", authorizeRole("ADMIN"), glController.getCustomerDeposits);

// Credit Notes
router.post("/credit-note", authorizeRole("ADMIN"), glController.createCreditNote);
router.get("/credit-note", authorizeRole("ADMIN"), glController.getCreditNotes);

// Debit Notes
router.post("/debit-note", authorizeRole("ADMIN"), glController.createDebitNote);
router.get("/debit-note", authorizeRole("ADMIN"), glController.getDebitNotes);

// Bad Debt Write-offs
router.post("/bad-debt-writeoff", authorizeRole("ADMIN"), glController.createBadDebtWriteOff);
router.get("/bad-debt-writeoff", authorizeRole("ADMIN"), glController.getBadDebtWriteOffs);

module.exports = router;
