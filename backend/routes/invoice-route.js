const express = require("express");
const router = express.Router();
const invoiceController = require("../controllers/invoice-controller");
const validate = require("../middlewares/zod-schema-validator");
const { createInvoiceSchema } = require("../config/zod-schema");

// Create sales invoice
router.post("/", validate(createInvoiceSchema), invoiceController.createInvoice);

// Get list of invoices
router.get("/", invoiceController.listInvoices);

// Get detailed info of a single invoice
router.get("/:id", invoiceController.getInvoiceById);

module.exports = router;
