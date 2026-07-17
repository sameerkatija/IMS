const express = require('express');
const router = express.Router();
const productCategoryController = require('../controllers/product-category-controller');
const { CategorySchema } = require('../config/zod-schema');
const validateRequest = require('../middlewares/zod-schema-validator');
// Get all categories
router.get(
    "/",
    productCategoryController.getAll
);

// Get category by ID
router.get(
    "/:id",
    productCategoryController.getById
);

// Create category
router.post(
    "/",
    validateRequest(CategorySchema),
    productCategoryController.create
);

// Update category
router.put(
    "/:id",
    validateRequest(CategorySchema),
    productCategoryController.update
);

// Reactivate Product Category
router.put(
    "/:id/activate",
    productCategoryController.activate
)


// // Delete category
router.delete(
    "/:id",
    productCategoryController.remove
);



module.exports = router;