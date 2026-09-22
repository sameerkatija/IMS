const invoiceModel = require("../models/invoice-model");

/**
 * Handles creation of new sales invoices (DRAFT or POSTED).
 */
async function createInvoice(req, res) {
  try {
    const {
      customerId,
      salesmanId,
      saleType,
      invoiceDate,
      discount,
      transportDiscount,
      paidAmount,
      creditApplied,
      documentStatus,
      description,
      items,
    } = req.body;
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
      documentStatus: documentStatus || "POSTED",
      description,
      items,
      createdById,
    });

    return res.status(201).json({
      type: "success",
      message: documentStatus === "DRAFT" ? "Draft invoice saved successfully." : "Invoice created and confirmed successfully.",
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
 * Updates an existing DRAFT invoice.
 */
async function updateInvoice(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        type: "error",
        message: "Invalid invoice ID.",
      });
    }

    const {
      customerId,
      salesmanId,
      saleType,
      invoiceDate,
      discount,
      transportDiscount,
      paidAmount,
      creditApplied,
      documentStatus,
      description,
      items,
    } = req.body;
    const createdById = req.user.id;

    const invoice = await invoiceModel.updateInvoice(
      id,
      {
        customerId,
        salesmanId,
        saleType,
        invoiceDate,
        discount,
        transportDiscount: transportDiscount !== undefined ? Number(transportDiscount) : 0,
        paidAmount,
        creditApplied,
        documentStatus,
        description,
        items,
      },
      createdById
    );

    return res.status(200).json({
      type: "success",
      message: documentStatus === "POSTED" ? "Invoice updated and confirmed successfully." : "Draft invoice updated successfully.",
      data: invoice,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to update invoice.",
    });
  }
}

/**
 * Confirms a DRAFT invoice and makes it immutable.
 */
async function confirmInvoice(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        type: "error",
        message: "Invalid invoice ID.",
      });
    }

    const createdById = req.user.id;
    const invoice = await invoiceModel.confirmInvoice(id, createdById);

    return res.status(200).json({
      type: "success",
      message: "Invoice confirmed and locked successfully.",
      data: invoice,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to confirm invoice.",
    });
  }
}

/**
 * Deletes an unconfirmed DRAFT invoice.
 */
async function deleteDraftInvoice(req, res) {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        type: "error",
        message: "Invalid invoice ID.",
      });
    }

    const result = await invoiceModel.deleteDraftInvoice(id);

    return res.status(200).json({
      type: "success",
      message: `Draft invoice ${result.invoiceNo} deleted successfully.`,
      data: result,
    });
  } catch (err) {
    console.error(err);
    return res.status(err.statusCode || 500).json({
      type: "error",
      message: err.message || "Failed to delete draft invoice.",
    });
  }
}

/**
 * Lists invoices with pagination and optional filters (customerId, salesmanId, status, documentStatus, saleType, and date ranges).
 */
async function listInvoices(req, res) {
  try {
    const isAll = req.query.limit === "all";
    const page = isAll ? 1 : Number(req.query.page || 1);
    const limit = isAll ? 10000 : Number(req.query.limit || 10);
    const skip = isAll ? 0 : (page - 1) * limit;

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
    if (req.query.documentStatus) {
      where.documentStatus = req.query.documentStatus;
    }
    if (req.query.saleType) {
      where.saleType = req.query.saleType;
    }

    if (req.query.search) {
      const searchStr = req.query.search.trim();
      where.OR = [
        {
          invoiceNo: {
            contains: searchStr,
            mode: "insensitive",
          },
        },
        {
          customer: {
            name: {
              contains: searchStr,
              mode: "insensitive",
            },
          },
        },
      ];
    }

    if (req.query.date) {
      const dateStr = String(req.query.date).trim();
      where.invoiceDate = {
        gte: new Date(`${dateStr}T00:00:00.000`),
        lte: new Date(`${dateStr}T23:59:59.999`),
      };
    } else if (req.query.from || req.query.to) {
      where.invoiceDate = {};
      if (req.query.from) {
        const fromStr = String(req.query.from).trim();
        where.invoiceDate.gte = fromStr.includes("T") ? new Date(fromStr) : new Date(`${fromStr}T00:00:00.000`);
      }
      if (req.query.to) {
        const toStr = String(req.query.to).trim();
        where.invoiceDate.lte = toStr.includes("T") ? new Date(toStr) : new Date(`${toStr}T23:59:59.999`);
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
  updateInvoice,
  confirmInvoice,
  deleteDraftInvoice,
  listInvoices,
  getInvoiceById,
};
