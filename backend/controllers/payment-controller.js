const paymentModel = require("../models/payment-model");

/**
 * Handles recording of a customer payment.
 */
async function recordCustomerPayment(req, res) {
  try {
    const { customerId, invoiceId, allocations, amount, isCreditApplied, paymentDate, description } = req.body;
    const createdById = req.user.id;

    const payment = await paymentModel.recordCustomerPayment({
      customerId,
      invoiceId,
      allocations,
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
 * Refunds a customer's existing store-credit balance as cash.
 * POST /api/payment/customer/refund-credit
 * Body: { customerId, amount, refundDate?, description? }
 */
async function refundCustomerCredit(req, res) {
  try {
    const { customerId, amount, refundDate, description } = req.body;
    const createdById = req.user.id;

    if (!customerId || !amount) {
      return res.status(400).json({
        type: "error",
        message: "customerId and amount are required.",
      });
    }

    const payment = await paymentModel.refundCustomerCreditBalance({
      customerId: Number(customerId),
      amount: Number(amount),
      refundDate,
      description,
      createdById,
    });

    return res.status(201).json({
      type: "success",
      message: "Store credit refunded to customer as cash successfully.",
      data: payment,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to refund customer credit.",
    });
  }
}

/**
 * Handles allocating an existing customer payment to invoices post-creation.
 */
async function allocateCustomerPayment(req, res) {
  try {
    const { customerPaymentId, allocations } = req.body;

    if (!customerPaymentId || !allocations || !Array.isArray(allocations)) {
      return res.status(400).json({
        type: "error",
        message: "customerPaymentId and allocations array are required.",
      });
    }

    const results = await paymentModel.allocateCustomerPayment({
      customerPaymentId: Number(customerPaymentId),
      allocations,
    });

    return res.status(200).json({
      type: "success",
      message: "Payment allocated successfully",
      data: results,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to allocate customer payment.",
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
    const { supplierId, purchaseId, allocations, amount, isCreditApplied, paymentDate, description } = req.body;
    const createdById = req.user.id;

    const payment = await paymentModel.recordSupplierPayment({
      supplierId,
      purchaseId,
      allocations,
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

/**
 * Handles allocating an existing supplier payment to purchases post-creation.
 */
async function allocateSupplierPayment(req, res) {
  try {
    const { supplierPaymentId, allocations } = req.body;

    if (!supplierPaymentId || !allocations || !Array.isArray(allocations)) {
      return res.status(400).json({
        type: "error",
        message: "supplierPaymentId and allocations array are required.",
      });
    }

    const results = await paymentModel.allocateSupplierPayment({
      supplierPaymentId: Number(supplierPaymentId),
      allocations,
    });

    return res.status(200).json({
      type: "success",
      message: "Supplier payment allocated successfully",
      data: results,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to allocate supplier payment.",
    });
  }
}

/**
 * Applies a customer's available store credit directly to an existing invoice.
 * POST /api/payment/customer/apply-credit
 * Body: { customerId, invoiceId, amount? }
 * If amount is omitted, applies the maximum possible (min of credit and balanceDue).
 */
async function applyStoreCreditToInvoice(req, res) {
  try {
    const { customerId, invoiceId, amount } = req.body;
    const createdById = req.user.id;

    if (!customerId || !invoiceId) {
      return res.status(400).json({
        type: "error",
        message: "customerId and invoiceId are required.",
      });
    }

    const result = await paymentModel.applyStoreCreditToInvoice({
      customerId: Number(customerId),
      invoiceId: Number(invoiceId),
      amount: amount != null ? Number(amount) : null,
      createdById,
    });

    return res.status(200).json({
      type: "success",
      message: `Rs. ${result.appliedAmount.toFixed(2)} store credit applied to Invoice ${result.invoiceNo}. Remaining credit: Rs. ${result.remainingCredit.toFixed(2)}.`,
      data: result,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to apply store credit to invoice.",
    });
  }
}

/**
 * Applies a supplier's available credit directly to an existing purchase.
 * POST /api/payment/supplier/apply-credit
 * Body: { supplierId, purchaseId, amount? }
 * If amount is omitted, applies the maximum possible (min of credit and balanceDue).
 */
async function applyStoreCreditToPurchase(req, res) {
  try {
    const { supplierId, purchaseId, amount } = req.body;
    const createdById = req.user.id;

    if (!supplierId || !purchaseId) {
      return res.status(400).json({
        type: "error",
        message: "supplierId and purchaseId are required.",
      });
    }

    const result = await paymentModel.applyStoreCreditToPurchase({
      supplierId: Number(supplierId),
      purchaseId: Number(purchaseId),
      amount: amount != null ? Number(amount) : null,
      createdById,
    });

    return res.status(200).json({
      type: "success",
      message: `Rs. ${result.appliedAmount.toFixed(2)} supplier credit applied to Purchase ${result.purchaseNo}. Remaining credit: Rs. ${result.remainingCredit.toFixed(2)}.`,
      data: result,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to apply supplier credit to purchase.",
    });
  }
}

module.exports = {
  recordCustomerPayment,
  refundCustomerCredit,
  allocateCustomerPayment,
  applyStoreCreditToInvoice,
  listCustomerPayments,
  recordSupplierPayment,
  allocateSupplierPayment,
  applyStoreCreditToPurchase,
  listSupplierPayments,
};
