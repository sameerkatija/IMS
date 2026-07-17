const express = require("express");
const router = express.Router();
const purchaseController = require("../controllers/purchase-controller");
const validate = require("../middlewares/zod-schema-validator");
const { createPurchaseSchema } = require("../config/zod-schema");

// Create a new purchase
router.post("/", validate(createPurchaseSchema), purchaseController.createPurchase);

// Get list of purchases
router.get("/", purchaseController.listPurchases);

// Get detailed info of a single purchase
router.get("/:id", purchaseController.getById || purchaseController.getPurchaseById);

module.exports = router;
