const product = require("../models/product-model");
const productCategory = require("../models/product-category-model");
const getAll = async (req, res) => {
    try {

        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 10);
        const skip = (page - 1) * limit;

        const where = {};

        if (req.query.search) {
            where.OR = [
                {
                    name: {
                        contains: req.query.search,
                        mode: "insensitive",
                    },
                },
                {
                    sku: {
                        contains: req.query.search,
                        mode: "insensitive",
                    },
                },
            ];
        }

        if (req.query.categoryId) {
            where.categoryId = Number(req.query.categoryId);
        }

        if (req.query.isActive !== undefined) {
            where.isActive = req.query.isActive === "true";
        }

        const [products, total] = await Promise.all([
            product.getAll({ where, skip, take: limit }),
            product.count(where),
        ]);

        return res.json({
            type: "success",
            data: products,
            total: total,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        console.error(err);

        return res.status(500).json({
            type: "error",
            message: "Failed to fetch products.",
        });
    }
};

const getById = async (req, res) => {
    try {
        const productId = Number(req.params.id);
        if (isNaN(productId)) {
            return res.status(400).json({
                type: "error",
                message: "Invalid product ID.",
            });
        }
        const productItem = await product.getById(productId);

        if (!productItem) {
            return res.status(404).json({
                type: "error",
                message: "Product not found.",
            });
        }

        res.status(200).json({ type: "success", data: productItem });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            type: "error",
            message: "Failed to fetch product.",
        });
    }
};

const create = async (req, res) => {
    try {
        const categoryId = req.body.categoryId;
        if (isNaN(categoryId)) {
            return res.status(400).json({
                type: "error",
                message: "Invalid Category ID.",
            });
        }
        const category = await productCategory.getById(categoryId);
        if (!category) {
            return res.status(404).json({
                type: "error",
                message: "Selected category does not exist."
            })
        }

        const existingSku = await product.getBySKU(req.body.sku);

        if (existingSku) {
            return res.status(400).json({
                type: "error",
                message: "SKU already exists.",
            });
        }

        if (req.body.barcode) {
            const existingBarcode = await product.getBybarCode(
                req.body.barcode
            );

            if (existingBarcode) {
                return res.status(400).json({
                    type: "error",
                    message: "Barcode already exists.",
                });
            }
        }

        const productItem = await product.create(req.body);

        return res.status(201).json({
            type: "success",
            message: "Product created successfully.",
            data: productItem,
        });
    } catch (err) {
        console.error(err);

        return res.status(500).json({
            type: "error",
            message: "Failed to create product.",
        });
    }
};

const update = async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (isNaN(id)) {
            return res.status(400).json({
                type: "error",
                message: "Invalid Product ID.",
            });
        }
         const categoryId = req.body.categoryId;
        if (isNaN(categoryId)) {
            return res.status(400).json({
                type: "error",
                message: "Invalid Category ID.",
            });
        }
        const category = await productCategory.getById(categoryId);
        if (!category) {
            return res.status(404).json({
                type: "error",
                message: "Selected category does not exist."
            })
        }
        const existing = await product.getById(id);

        if (!existing) {
            return res.status(404).json({
                type: "error",
                message: "Product not found.",
            });
        }

        if (
            req.body.sku &&
            req.body.sku !== existing.sku
        ) {
            const sku = await product.getBySKU(req.body.sku);

            if (sku) {
                return res.status(400).json({
                    type: "error",
                    message: "SKU already exists.",
                });
            }
        }

        if (
            req.body.barcode &&
            req.body.barcode !== existing.barcode
        ) {
            const barcode = await product.getBybarCode(req.body.barcode);

            if (barcode) {
                return res.status(400).json({
                    type: "error",
                    message: "Barcode already exists.",
                });
            }
        }

        const productItem = await product.update(id, req.body);

        return res.json({
            type: "success",
            message: "Product updated successfully.",
            data: productItem,
        });
    } catch (err) {
        console.error(err);

        return res.status(500).json({
            type: "error",
            message: "Failed to update product.",
        });
    }
};

const deactivateProduct = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                type: "error",
                message: "Invalid Product ID.",
            });
        }
        const existing = await product.getById(id);

        if (!existing) {
            return res.status(404).json({
                type: "error",
                message: "Product not found.",
            });
        }

        await product.update(id, {
            isActive: false,
        });

        return res.json({
            type: "success",
            message: "Product deactivated successfully.",
        });
    } catch (err) {
        console.error(err);

        return res.status(500).json({
            type: "error",
            message: "Failed to deactivate product.",
        });
    }
};

const activateProduct = async (req, res) => {
    try {
        const id = Number(req.params.id);

        const existing = await product.getById(id);

        if (!existing) {
            return res.status(404).json({
                type: "error",
                message: "Product not found.",
            });
        }

        await product.update(id, {
            isActive: true,
        });

        return res.json({
            type: "success",
            message: "Product activated successfully.",
        });
    } catch (err) {
        console.error(err);

        return res.status(500).json({
            type: "error",
            message: "Failed to activate product.",
        });
    }
};

const getLowStock = async (req, res) => {
    try {
        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 10);

        const skip = (page - 1) * limit;

        const [products, total] = await Promise.all([
            product.findLowStock({
                skip,
                take: limit,
            }),
            product.countLowStock(),
        ]);

        return res.status(200).json({
            type: "success",
            data: products,
            total,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        console.error(err);

        return res.status(500).json({
            type: "error",
            message: "Failed to fetch low stock products.",
        });
    }
};


const getBySKU = async (req, res) => {
    try {
        const productItem = await product.getBySKU(req.params.sku);

        if (!productItem) {
            return res.status(404).json({
                type: "error",
                message: "Product not found.",
            });
        }

        return res.status(200).json({
            type: "success",
            data: productItem,
        });
    } catch (err) {
        console.error(err);

        return res.status(500).json({
            type: "error",
            message: "Failed to fetch product.",
        });
    }
};

const getByBarcode = async (req, res) => {
    try {
        const productItem = await product.getBybarCode(req.params.barcode);

        if (!productItem) {
            return res.status(404).json({
                type: "error",
                message: "Product not found.",
            });
        }

        return res.status(200).json({
            type: "success",
            data: productItem,
        });
    } catch (err) {
        console.error(err);

        return res.status(500).json({
            type: "error",
            message: "Failed to fetch product.",
        });
    }
};

module.exports = {
    getAll,
    getById,
    create,
    update,
    deactivateProduct,
    activateProduct,
    getLowStock,
    getBySKU,
    getByBarcode
};
