const express = require("express");
const router = express.Router();
const purchaseReturnController = require("../controllers/purchase-return-controller");
const validate = require("../middlewares/zod-schema-validator");
const { createPurchaseReturnSchema } = require("../config/zod-schema");

// Create a new purchase return
router.post("/", validate(createPurchaseReturnSchema), purchaseReturnController.createPurchaseReturn);

// Get list of purchase returns
router.get("/", purchaseReturnController.listPurchaseReturns);

// Get detailed info of a single purchase return
router.get("/:id", purchaseReturnController.getPurchaseReturnById);

module.exports = router;
