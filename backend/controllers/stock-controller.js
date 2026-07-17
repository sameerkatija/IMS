const stockModel = require("../models/stock-model");

/**
 * Handles creation of manual stock adjustments (recount, damage, expiry).
 */
async function createAdjustment(req, res) {
  try {
    const { productId, quantity, reason, description, secretKey } = req.body;
    const createdById = req.user.id;

    // Verify secret key
    const env = require("../config/env");
    if (secretKey !== env.registrationSecret) {
      return res.status(403).json({
        type: "error",
        message: "Invalid secret key. Access denied for manual stock adjustment.",
      });
    }

    const adjustment = await stockModel.createAdjustment({
      productId,
      quantity,
      reason,
      description,
      createdById,
    });

    return res.status(201).json({
      type: "success",
      message: "Stock adjusted successfully",
      data: adjustment,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to create stock adjustment.",
    });
  }
}

/**
 * Lists stock movement audit logs with optional filters and pagination.
 */
async function listMovements(req, res) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;

    const where = {};

    if (req.query.productId) {
      where.productId = Number(req.query.productId);
    }
    if (req.query.type) {
      where.type = req.query.type;
    }
    if (req.query.referenceType) {
      where.referenceType = req.query.referenceType;
    }

    const [movements, total] = await Promise.all([
      stockModel.listMovements({ where, skip, take: limit }),
      stockModel.countMovements(where),
    ]);

    return res.status(200).json({
      type: "success",
      data: movements,
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
      message: err.message || "Failed to fetch stock movements.",
    });
  }
}

/**
 * Verifies that the denormalized stockQuantity in the Product table matches the sum of all movements.
 */
async function verifyIntegrity(req, res) {
  try {
    const productId = Number(req.params.productId);
    if (isNaN(productId)) {
      return res.status(400).json({
        type: "error",
        message: "Invalid product ID.",
      });
    }

    const result = await stockModel.verifyIntegrity(productId);

    return res.status(200).json({
      type: "success",
      data: result,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to verify stock integrity.",
    });
  }
}

module.exports = {
  createAdjustment,
  listMovements,
  verifyIntegrity,
};
