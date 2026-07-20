const express = require("express");
const router = express.Router();
const paymentController = require("../controllers/payment-controller");
const validate = require("../middlewares/zod-schema-validator");
const { createCustomerPaymentSchema, createSupplierPaymentSchema } = require("../config/zod-schema");

// Customer payments
router.post("/customer", validate(createCustomerPaymentSchema), paymentController.recordCustomerPayment);
router.post("/customer/refund-credit", paymentController.refundCustomerCredit);
router.post("/customer/allocate", paymentController.allocateCustomerPayment);
router.get("/customer", paymentController.listCustomerPayments);

// Supplier payments
router.post("/supplier", validate(createSupplierPaymentSchema), paymentController.recordSupplierPayment);
router.get("/supplier", paymentController.listSupplierPayments);

module.exports = router;
