const express = require("express");
const router = express.Router();
const salesReturnController = require("../controllers/sales-return-controller");
const validate = require("../middlewares/zod-schema-validator");
const { createSalesReturnSchema } = require("../config/zod-schema");

// Create sales return
router.post("/", validate(createSalesReturnSchema), salesReturnController.createSalesReturn);

// Get list of sales returns
router.get("/", salesReturnController.listSalesReturns);

// Get detailed info of a single sales return
router.get("/:id", salesReturnController.getSalesReturnById);

module.exports = router;
