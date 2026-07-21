const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment-controller");
const validate = require("../middlewares/zod-schema-validator");
const { createCustomerPaymentSchema, createSupplierPaymentSchema } = require("../config/zod-schema");

// Customer payments
router.post("/customer", validate(createCustomerPaymentSchema), paymentController.recordCustomerPayment);
router.post("/customer/refund-credit", paymentController.refundCustomerCredit);
router.post("/customer/allocate", paymentController.allocateCustomerPayment);
// Apply existing store credit to an invoice without a PaymentAllocation record.
// amount is optional — omit to auto-apply the maximum possible.
router.post("/customer/apply-credit", paymentController.applyStoreCreditToInvoice);
router.get("/customer", paymentController.listCustomerPayments);

// Supplier payments
router.post("/supplier", validate(createSupplierPaymentSchema), paymentController.recordSupplierPayment);
router.post("/supplier/allocate", paymentController.allocateSupplierPayment);
// Apply existing supplier credit to a purchase without a SupplierPaymentAllocation record.
router.post("/supplier/apply-credit", paymentController.applyStoreCreditToPurchase);
router.get("/supplier", paymentController.listSupplierPayments);

module.exports = router;
