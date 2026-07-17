const express = require('express');
const router = express.Router();
const salesTargetController = require('../controllers/sales-target-controller');
const validate = require("../middlewares/zod-schema-validator");
const { setTargetSchema, updateTargetSchema } = require("../config/zod-schema");

// get all sales target
router.get("/", salesTargetController.getAll);

//
router.get("/:id", salesTargetController.getById);

router.post("/", validate(setTargetSchema), salesTargetController.create);

router.put("/:id", validate(updateTargetSchema), salesTargetController.update);

router.delete("/:id", salesTargetController.remove);

// New salesman endpoints per Phase 8 specification
router.post("/salesman/:id/target", validate(setTargetSchema), salesTargetController.setTarget);
router.get("/salesman/:id/target", salesTargetController.listTargets);
router.get("/salesman/:id/achievement", salesTargetController.getAchievement);

module.exports = router;

