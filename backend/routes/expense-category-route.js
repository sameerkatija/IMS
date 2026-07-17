const express = require('express');
const router = express.Router();
const expenseCategoryController = require('../controllers/expense-category-controller');
const { CategorySchema } = require('../config/zod-schema');
const validateRequest = require('../middlewares/zod-schema-validator');
// Get all categories
router.get(
    "/",
    expenseCategoryController.getAll
);

// Get category by ID
router.get(
    "/:id",
    expenseCategoryController.getById
);

// Create category
router.post(
    "/",
    validateRequest(CategorySchema),
    expenseCategoryController.create
);

// Update category
router.put(
    "/:id",
    validateRequest(CategorySchema),
    expenseCategoryController.update
);

// Reactivate Expense Category
router.put(
    "/:id/activate",
    expenseCategoryController.activate
)



// Delete category
router.delete(
    "/:id",
    expenseCategoryController.remove
);



module.exports = router;