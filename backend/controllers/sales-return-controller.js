const salesReturnModel = require("../models/sales-return-model");

/**
 * Handles creation of new sales returns.
 */
async function createSalesReturn(req, res) {
  try {
    const { customerId, invoiceId, returnDate, reason, items, refundType } = req.body;
    const createdById = req.user.id;

    const salesReturn = await salesReturnModel.createSalesReturn({
      customerId,
      invoiceId,
      returnDate,
      reason,
      items,
      refundType,
      createdById,
    });

    return res.status(201).json({
      type: "success",
      message: "Sales return recorded successfully",
      data: salesReturn,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to create sales return.",
    });
  }
}

/**
 * Lists sales returns with pagination and optional filters (customerId, invoiceId, and date ranges).
 */
async function listSalesReturns(req, res) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;

    const where = {};

    if (req.query.customerId) {
      where.customerId = Number(req.query.customerId);
    }
    if (req.query.invoiceId) {
      where.invoiceId = Number(req.query.invoiceId);
    }

    if (req.query.from || req.query.to) {
      where.returnDate = {};
      if (req.query.from) {
        where.returnDate.gte = new Date(req.query.from);
      }
      if (req.query.to) {
        where.returnDate.lte = new Date(req.query.to);
      }
    }

    const [returns, total] = await Promise.all([
      salesReturnModel.getAllSalesReturns({ where, skip, take: limit }),
      salesReturnModel.countSalesReturns(where),
    ]);

    return res.status(200).json({
      type: "success",
      data: returns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to retrieve sales returns.",
    });
  }
}

/**
 * Fetches details of a single sales return by its ID.
 */
async function getSalesReturnById(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        type: "error",
        message: "Invalid sales return ID.",
      });
    }

    const salesReturn = await salesReturnModel.getSalesReturnById(id);
    if (!salesReturn) {
      return res.status(404).json({
        type: "error",
        message: "Sales return not found.",
      });
    }

    return res.status(200).json({
      type: "success",
      data: salesReturn,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to retrieve sales return details.",
    });
  }
}

module.exports = {
  createSalesReturn,
  listSalesReturns,
  getSalesReturnById,
};
