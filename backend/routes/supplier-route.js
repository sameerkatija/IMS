const express = require('express');
const router = express.Router();
const supplierController = require('../controllers/supplier-controller');
const validate = require("../middlewares/zod-schema-validator");
const { supplierSchema } = require("../config/zod-schema");
// get all
router.get('/', supplierController.getAllSuppliers);

// create
router.post('/', validate(supplierSchema), supplierController.createSupplier);

// get by id
router.get('/:id', supplierController.getSupplierById);

// update
router.put('/:id', validate(supplierSchema), supplierController.updateSupplier);

//activate user 
router.put('/:id/activate', supplierController.activateSupplier);

//deactivate user
router.delete('/:id', supplierController.deactivateSupplier);

//get supplier ledger history
router.get('/:id/ledger', supplierController.getSupplierLedger);

//reconcile supplier ledger
router.get('/:id/reconcile', supplierController.reconcileSupplierLedger);

module.exports = router;


// GET /api/suppliers/:id/ledger
// GET /api/suppliers/:id/purchases
// GET /api/suppliers/:id/payments
// GET /api/suppliers/:id/purchase-returns