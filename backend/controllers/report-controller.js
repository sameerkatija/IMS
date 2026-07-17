const reportModel = require("../models/report-model");

/**
 * Extracts and parses 'from' and 'to' date parameters, defaulting to the last 7 days.
 */
function getFromToDates(req) {
  let { from, to } = req.query;

  if (!from || !to) {
    const now = new Date();
    const toDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
    const fromDate = new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);
    fromDate.setUTCHours(0, 0, 0, 0);

    return {
      from: fromDate,
      to: toDate,
    };
  }

  // Client sends plain date strings like "2026-07-18".
  // Parse in pure UTC to avoid server timezone offsets.
  const [fYear, fMonth, fDay] = from.split("-").map(Number);
  const fromDate = new Date(Date.UTC(fYear, fMonth - 1, fDay, 0, 0, 0, 0));

  const [tYear, tMonth, tDay] = to.split("-").map(Number);
  const toDate = new Date(Date.UTC(tYear, tMonth - 1, tDay, 23, 59, 59, 999));

  return {
    from: fromDate,
    to: toDate,
  };
}

async function getDashboardMetrics(req, res) {
  try {
    const metrics = await reportModel.getDashboardMetrics();
    return res.status(200).json({
      type: "success",
      data: metrics,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      type: "error",
      message: err.message || "Failed to retrieve dashboard metrics.",
    });
  }
}

async function salesByDay(req, res) {
  try {
    const { from, to } = getFromToDates(req);
    const customerId = req.query.customerId ? Number(req.query.customerId) : null;

    const data = await reportModel.salesByDay(from, to, customerId);
    return res.status(200).json({
      type: "success",
      data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      type: "error",
      message: err.message || "Failed to retrieve daily sales report.",
    });
  }
}

async function salesBySalesman(req, res) {
  try {
    const { from, to } = getFromToDates(req);
    const data = await reportModel.salesBySalesman(from, to);
    return res.status(200).json({
      type: "success",
      data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      type: "error",
      message: err.message || "Failed to retrieve salesman sales report.",
    });
  }
}

async function purchasesByDay(req, res) {
  try {
    const { from, to } = getFromToDates(req);
    const supplierId = req.query.supplierId ? Number(req.query.supplierId) : null;

    const data = await reportModel.purchasesByDay(from, to, supplierId);
    return res.status(200).json({
      type: "success",
      data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      type: "error",
      message: err.message || "Failed to retrieve daily purchases report.",
    });
  }
}

async function currentStockReport(req, res) {
  try {
    const data = await reportModel.currentStockReport();
    return res.status(200).json({
      type: "success",
      data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      type: "error",
      message: err.message || "Failed to retrieve current stock report.",
    });
  }
}

async function lowStockReport(req, res) {
  try {
    const data = await reportModel.lowStockReport();
    return res.status(200).json({
      type: "success",
      data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      type: "error",
      message: err.message || "Failed to retrieve low stock report.",
    });
  }
}

async function customerLedgerReport(req, res) {
  try {
    const data = await reportModel.customerLedgerReport();
    return res.status(200).json({
      type: "success",
      data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      type: "error",
      message: err.message || "Failed to retrieve receivables ledger report.",
    });
  }
}

async function supplierLedgerReport(req, res) {
  try {
    const data = await reportModel.supplierLedgerReport();
    return res.status(200).json({
      type: "success",
      data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      type: "error",
      message: err.message || "Failed to retrieve payables ledger report.",
    });
  }
}

async function profitReport(req, res) {
  try {
    const { from, to } = getFromToDates(req);
    const profit = await reportModel.profitReport(from, to);
    return res.status(200).json({
      type: "success",
      data: { profit },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      type: "error",
      message: err.message || "Failed to retrieve profit report.",
    });
  }
}

async function expenseReport(req, res) {
  try {
    const { from, to } = getFromToDates(req);
    const data = await reportModel.expenseReport(from, to);
    return res.status(200).json({
      type: "success",
      data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      type: "error",
      message: err.message || "Failed to retrieve expense report.",
    });
  }
}

async function netProfitReport(req, res) {
  try {
    const { from, to } = getFromToDates(req);
    const data = await reportModel.netProfitReport(from, to);
    return res.status(200).json({
      type: "success",
      data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      type: "error",
      message: err.message || "Failed to retrieve net profit report.",
    });
  }
}

async function salesByProduct(req, res) {
  try {
    const { from, to } = getFromToDates(req);
    const data = await reportModel.salesByProduct(from, to);
    return res.status(200).json({
      type: "success",
      data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      type: "error",
      message: err.message || "Failed to retrieve product sales report.",
    });
  }
}

async function salesByCategory(req, res) {
  try {
    const { from, to } = getFromToDates(req);
    const data = await reportModel.salesByCategory(from, to);
    return res.status(200).json({
      type: "success",
      data,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      type: "error",
      message: err.message || "Failed to retrieve category sales report.",
    });
  }
}

module.exports = {
  getDashboardMetrics,
  salesByDay,
  salesBySalesman,
  purchasesByDay,
  currentStockReport,
  lowStockReport,
  customerLedgerReport,
  supplierLedgerReport,
  profitReport,
  expenseReport,
  netProfitReport,
  salesByProduct,
  salesByCategory,
};
