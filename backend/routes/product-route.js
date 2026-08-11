const express = require('express');
const router = express.Router();
const productController = require('../controllers/product-controller');
const validate = require('../middlewares/zod-schema-validator');
const authorizeRole = require('../middlewares/authorize-role');
const { productSchema } = require('../config/zod-schema');

// Get all product
router.get(
    "/",
    productController.getAll
);


//Get Low Stock Product
router.get(
    "/low-stock", 
    productController.getLowStock
);

// Get product by SKU
router.get(
    "/sku/:sku", 
    productController.getBySKU
);

// GET PRODUCT BY BARCODE

router.get(
    "/barcode/:barcode", 
    productController.getByBarcode
);

// Get product by ID
router.get(
    "/:id",
    productController.getById
);



// Create product (ADMIN only)
router.post(
    "/",
    authorizeRole("ADMIN"),
    validate(productSchema),
    productController.create
);

// Update product (ADMIN only)
router.put(
    "/:id",
    authorizeRole("ADMIN"),
    validate(productSchema),
    productController.update
);

// Reactivate Product (ADMIN only)
router.put(
    "/:id/activate",
    authorizeRole("ADMIN"),
    productController.activateProduct
)


// Delete product (ADMIN only)
router.delete(
    "/:id",
    authorizeRole("ADMIN"),
    productController.deactivateProduct
);



module.exports = router;