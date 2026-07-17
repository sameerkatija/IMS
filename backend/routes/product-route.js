const express = require('express');
const router = express.Router();
const productController = require('../controllers/product-controller');
const validate = require('../middlewares/zod-schema-validator');
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



// Create product
router.post(
    "/",
    validate(productSchema),
    productController.create
);

// Update product
router.put(
    "/:id",
    validate(productSchema),
    productController.update
);

// Reactivate Product
router.put(
    "/:id/activate",
    productController.activateProduct
)


// Delete product
router.delete(
    "/:id",
    productController.deactivateProduct
);



module.exports = router;