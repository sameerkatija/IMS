const express = require("express");
const router = express.Router();
const stockController = require("../controllers/stock-controller");
const validate = require("../middlewares/zod-schema-validator");
const authorize = require("../middlewares/authorize-role");
const { createAdjustmentSchema, listMovementsQuerySchema } = require("../config/zod-schema");

// Adjust stock (damaged, expired, recounting corrections)
router.post(
  "/adjustments",
  authorize("ADMIN"),
  validate(createAdjustmentSchema),
  stockController.createAdjustment
);

// Get stock movements audit history log
router.get(
  "/movements",
  validate(listMovementsQuerySchema),
  stockController.listMovements
);

// Verify current product stock denormalized snapshot against total movement ledger
router.get(
  "/verify/:productId",
  authorize("ADMIN"),
  stockController.verifyIntegrity
);

module.exports = router;
