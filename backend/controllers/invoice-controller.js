const invoiceModel = require("../models/invoice-model");

/**
 * Handles creation of new sales invoices.
 */
async function createInvoice(req, res) {
  try {
    const { customerId, salesmanId, saleType, invoiceDate, discount, transportDiscount, paidAmount, creditApplied, description, items } = req.body;
    const createdById = req.user.id;

    const invoice = await invoiceModel.createInvoice({
      customerId,
      salesmanId,
      saleType,
      invoiceDate,
      discount,
      transportDiscount: transportDiscount !== undefined ? Number(transportDiscount) : 0,
      paidAmount,
      creditApplied,
      description,
      items,
      createdById,
    });

    return res.status(201).json({
      type: "success",
      message: "Invoice created successfully",
      data: invoice,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to create sales invoice.",
    });
  }
}

/**
 * Lists invoices with pagination and optional filters (customerId, salesmanId, status, saleType, and date ranges).
 */
async function listInvoices(req, res) {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;

    const where = {};

    if (req.query.customerId) {
      where.customerId = Number(req.query.customerId);
    }
    if (req.query.salesmanId) {
      where.salesmanId = Number(req.query.salesmanId);
    }
    if (req.query.status) {
      where.status = req.query.status;
    }
    if (req.query.saleType) {
      where.saleType = req.query.saleType;
    }

    if (req.query.from || req.query.to) {
      where.invoiceDate = {};
      if (req.query.from) {
        where.invoiceDate.gte = new Date(req.query.from);
      }
      if (req.query.to) {
        where.invoiceDate.lte = new Date(req.query.to);
      }
    }

    const [invoices, total] = await Promise.all([
      invoiceModel.getAllInvoices({ where, skip, take: limit }),
      invoiceModel.countInvoices(where),
    ]);

    return res.status(200).json({
      type: "success",
      data: invoices,
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
      message: err.message || "Failed to retrieve invoices.",
    });
  }
}

/**
 * Fetches details of a single invoice by its ID.
 */
async function getInvoiceById(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        type: "error",
        message: "Invalid invoice ID.",
      });
    }

    const invoice = await invoiceModel.getInvoiceById(id);
    if (!invoice) {
      return res.status(404).json({
        type: "error",
        message: "Invoice not found.",
      });
    }

    return res.status(200).json({
      type: "success",
      data: invoice,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to retrieve invoice details.",
    });
  }
}

module.exports = {
  createInvoice,
  listInvoices,
  getInvoiceById,
};
