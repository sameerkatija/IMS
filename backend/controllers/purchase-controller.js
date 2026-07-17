const purchaseModel = require("../models/purchase-model");

/**
 * Handles creation of new purchase transactions.
 */
async function createPurchase(req, res) {
  try {
    const { supplierId, purchaseDate, discount, paidAmount, creditApplied, description, items } = req.body;
    const createdById = req.user.id;

    const purchase = await purchaseModel.createPurchase({
      supplierId,
      purchaseDate,
      discount,
      paidAmount,
      creditApplied,
      description,
      items,
      createdById,
    });

    return res.status(201).json({
      type: "success",
      message: "Purchase created successfully",
      data: purchase,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to create purchase transaction.",
    });
  }
}

/**
 * Lists supplier purchases with pagination and optional filters (supplierId, from/to dates).
 */
async function listPurchases(req, res) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;

    const where = {};

    if (req.query.supplierId) {
      where.supplierId = Number(req.query.supplierId);
    }

    if (req.query.from || req.query.to) {
      where.purchaseDate = {};
      if (req.query.from) {
        where.purchaseDate.gte = new Date(req.query.from);
      }
      if (req.query.to) {
        where.purchaseDate.lte = new Date(req.query.to);
      }
    }

    const [purchases, total] = await Promise.all([
      purchaseModel.getAllPurchases({ where, skip, take: limit }),
      purchaseModel.countPurchases(where),
    ]);

    return res.status(200).json({
      type: "success",
      data: purchases,
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
      message: err.message || "Failed to retrieve purchases.",
    });
  }
}

/**
 * Fetches single purchase details by its ID.
 */
async function getPurchaseById(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        type: "error",
        message: "Invalid purchase ID.",
      });
    }

    const purchase = await purchaseModel.getPurchaseById(id);
    if (!purchase) {
      return res.status(404).json({
        type: "error",
        message: "Purchase not found.",
      });
    }

    return res.status(200).json({
      type: "success",
      data: purchase,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to retrieve purchase details.",
    });
  }
}

module.exports = {
  createPurchase,
  listPurchases,
  getPurchaseById,
};
