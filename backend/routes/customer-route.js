const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customer-controller');
const validate = require("../middlewares/zod-schema-validator");
const { customerSchema } = require("../config/zod-schema");
// get all
router.get('/', customerController.getAllCustomers);

// create
router.post('/', validate(customerSchema), customerController.createCustomer);

// get by id
router.get('/:id', customerController.getCustomerById);

// update
router.put('/:id', validate(customerSchema), customerController.updateCustomer);

//activate user 
router.put('/:id/activate', customerController.activateCustomer);

//deactivate user
router.delete('/:id', customerController.deactivateCustomer);

//get customer ledger history
router.get('/:id/ledger', customerController.getCustomerLedger);

module.exports = router;


// GET /api/customers/:id/ledger
// GET /api/customers/:id/invoices
// GET /api/customers/:id/payments
// GET /api/customers/:id/sales-returns