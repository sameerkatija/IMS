const express = require("express");
const router = express.Router();
const reportController = require("../controllers/report-controller");

// Dashboard summary metrics
router.get("/dashboard", reportController.getDashboardMetrics);

// Daily sales reports
router.get("/sales", reportController.salesByDay);

// Leaderboard sales reports by salesman
router.get("/sales-by-salesman", reportController.salesBySalesman);

// Daily purchases reports
router.get("/purchases", reportController.purchasesByDay);

// Stock valuation report
router.get("/current-stock", reportController.currentStockReport);

// Low stock report
router.get("/low-stock", reportController.lowStockReport);

// Customer receivables ledger report (with aging buckets)
router.get("/customer-ledger", reportController.customerLedgerReport);

// Supplier payables ledger report
router.get("/supplier-ledger", reportController.supplierLedgerReport);

// Profit margins report
router.get("/profit", reportController.profitReport);

// Grouped expenses report
router.get("/expense", reportController.expenseReport);

// Net profit margins report
router.get("/net-profit", reportController.netProfitReport);

// Product gross sales report
router.get("/sales-by-product", reportController.salesByProduct);

// Category gross sales report
router.get("/sales-by-category", reportController.salesByCategory);

module.exports = router;
