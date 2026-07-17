const purchaseReturnModel = require("../models/purchase-return-model");

/**
 * Handles creation of new purchase returns.
 */
async function createPurchaseReturn(req, res) {
  try {
    const { supplierId, purchaseId, returnDate, reason, items } = req.body;
    const createdById = req.user.id;

    const purchaseReturn = await purchaseReturnModel.createPurchaseReturn({
      supplierId,
      purchaseId,
      returnDate,
      reason,
      items,
      createdById,
    });

    return res.status(201).json({
      type: "success",
      message: "Purchase return recorded successfully",
      data: purchaseReturn,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to create purchase return.",
    });
  }
}

/**
 * Lists supplier purchase returns with pagination and optional filters.
 */
async function listPurchaseReturns(req, res) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;

    const where = {};

    if (req.query.supplierId) {
      where.supplierId = Number(req.query.supplierId);
    }
    if (req.query.purchaseId) {
      where.purchaseId = Number(req.query.purchaseId);
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
      purchaseReturnModel.getAllPurchaseReturns({ where, skip, take: limit }),
      purchaseReturnModel.countPurchaseReturns(where),
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
      message: err.message || "Failed to retrieve purchase returns.",
    });
  }
}

/**
 * Fetches single purchase return details by its ID.
 */
async function getPurchaseReturnById(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        type: "error",
        message: "Invalid return ID.",
      });
    }

    const purchaseReturn = await purchaseReturnModel.getPurchaseReturnById(id);
    if (!purchaseReturn) {
      return res.status(404).json({
        type: "error",
        message: "Purchase return not found.",
      });
    }

    return res.status(200).json({
      type: "success",
      data: purchaseReturn,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to retrieve purchase return details.",
    });
  }
}

module.exports = {
  createPurchaseReturn,
  listPurchaseReturns,
  getPurchaseReturnById,
};
