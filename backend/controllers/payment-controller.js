const paymentModel = require("../models/payment-model");

/**
 * Handles recording of a customer payment.
 */
async function recordCustomerPayment(req, res) {
  try {
    const { customerId, invoiceId, amount, isCreditApplied, paymentDate, description } = req.body;
    const createdById = req.user.id;

    const payment = await paymentModel.recordCustomerPayment({
      customerId,
      invoiceId,
      amount,
      isCreditApplied,
      paymentDate,
      description,
      createdById,
    });

    return res.status(201).json({
      type: "success",
      message: isCreditApplied ? "Customer store credit applied successfully" : "Customer payment recorded successfully",
      data: payment,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to record customer payment.",
    });
  }
}

/**
 * Lists customer payments with pagination and optional filters.
 */
async function listCustomerPayments(req, res) {
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
      where.paymentDate = {};
      if (req.query.from) {
        where.paymentDate.gte = new Date(req.query.from);
      }
      if (req.query.to) {
        where.paymentDate.lte = new Date(req.query.to);
      }
    }

    const [payments, total] = await Promise.all([
      paymentModel.getAllCustomerPayments({ where, skip, take: limit }),
      paymentModel.countCustomerPayments(where),
    ]);

    return res.status(200).json({
      type: "success",
      data: payments,
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
      message: err.message || "Failed to retrieve customer payments.",
    });
  }
}

/**
 * Handles recording of a supplier payment.
 */
async function recordSupplierPayment(req, res) {
  try {
    const { supplierId, purchaseId, amount, isCreditApplied, paymentDate, description } = req.body;
    const createdById = req.user.id;

    const payment = await paymentModel.recordSupplierPayment({
      supplierId,
      purchaseId,
      amount,
      isCreditApplied,
      paymentDate,
      description,
      createdById,
    });

    return res.status(201).json({
      type: "success",
      message: isCreditApplied ? "Supplier credit applied successfully" : "Supplier payment recorded successfully",
      data: payment,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to process supplier payment.",
    });
  }
}

/**
 * Lists supplier payments with pagination and optional filters.
 */
async function listSupplierPayments(req, res) {
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
      where.paymentDate = {};
      if (req.query.from) {
        where.paymentDate.gte = new Date(req.query.from);
      }
      if (req.query.to) {
        where.paymentDate.lte = new Date(req.query.to);
      }
    }

    const [payments, total] = await Promise.all([
      paymentModel.getAllSupplierPayments({ where, skip, take: limit }),
      paymentModel.countSupplierPayments(where),
    ]);

    return res.status(200).json({
      type: "success",
      data: payments,
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
      message: err.message || "Failed to retrieve supplier payments.",
    });
  }
}

module.exports = {
  recordCustomerPayment,
  listCustomerPayments,
  recordSupplierPayment,
  listSupplierPayments,
};
