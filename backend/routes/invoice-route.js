const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoice-controller");
const validate = require("../middlewares/zod-schema-validator");
const { createInvoiceSchema, updateInvoiceSchema } = require("../config/zod-schema");

// Create sales invoice (DRAFT or POSTED)
router.post("/", validate(createInvoiceSchema), invoiceController.createInvoice);

// Get list of invoices
router.get("/", invoiceController.listInvoices);

// Get detailed info of a single invoice
router.get("/:id", invoiceController.getInvoiceById);

// Update a DRAFT invoice
router.put("/:id", validate(updateInvoiceSchema), invoiceController.updateInvoice);

// Confirm and lock a DRAFT invoice (makes it immutable)
router.post("/:id/confirm", invoiceController.confirmInvoice);

// Delete an unconfirmed DRAFT invoice
router.delete("/:id", invoiceController.deleteDraftInvoice);

module.exports = router;
