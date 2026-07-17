const express = require('express');
const router = express.Router();
const salesmanController = require('../controllers/salesman-controller');
const validate = require("../middlewares/zod-schema-validator");
const { salesmanSchema } = require("../config/zod-schema");

// get all salesman
router.get('/', salesmanController.getAllSalesmans);

// create    salesman
router.post('/', validate(salesmanSchema), salesmanController.createSalesman);

// get salesman by id
router.get('/:id', salesmanController.getSalesmanById);

// update salesman
router.put('/:id', validate(salesmanSchema), salesmanController.updateSalesman);

//activate salesman
router.put('/:id/activate', salesmanController.activateSalesman);

//deactivate salesman
router.delete('/:id', salesmanController.deactivateSalesman);

// get salesmen target
router.get("/:id/target", salesmanController.getSalesmanTargets);

module.exports = router;


// GET /api/salesmen/:id/invoices

// GET /api/salesmen/:id/performance

// GET /api/salesmen/:id/monthly-sales