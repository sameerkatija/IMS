const productCategory = require("../models/product-category-model");

const getAll = async (req, res) => {
    try {
        const filters = {};
        if (req.query.isActive !== undefined) {
            filters.isActive = req.query.isActive === "true";
        }
        const categories = await productCategory.getAll(filters);

        res.status(200).json({ type: "success", message: "Product categories fetched successfully", data: categories });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            type: "error",
            message: "Failed to fetch product categories.",
        });
    }
};

const getById = async (req, res) => {
    try {
        if (isNaN(Number(req.params.id))) {
            return res.status(400).json({
                type: "error",
                message: "Invalid product category ID.",
            });
        }
        const category = await productCategory.getById(Number(req.params.id));

        if (!category) {
            return res.status(404).json({
                type: "error",
                message: "Product category not found.",
            });
        }

        res.status(200).json({ type: "success", message: "Product category fetched successfully", data: category });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            type: "error",
            message: "Failed to fetch product category.",
        });
    }
};

const create = async (req, res) => {
    const name = req.body.name?.toUpperCase().trim();
    try {
        const existingCategory = await productCategory.getByName(name);
        if (existingCategory) {
            return res.status(400).json({
                type: "error",
                message: "Product category with this name already exists.",
            });
        }
        const category = await productCategory.create({
            name,
        });

        res.status(201).json({ type: "success", message: "Product category created successfully", data: category });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            type: "error",
            message: "Failed to create product category.",
        });
    }
};

const update = async (req, res) => {
    try {
        const name = req.body.name?.toUpperCase().trim();
        const isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : undefined;

        if (name) {
            const existingCategory = await productCategory.getByName(name);
            if (existingCategory && existingCategory.id !== Number(req.params.id)) {
                return res.status(400).json({
                    type: "error",
                    message: "Product category with this name already exists.",
                });
            }
        }

        const category = await productCategory.update(
            Number(req.params.id),
            {
                ...(name && { name }),
                ...(isActive !== undefined && { isActive }),
            }
        );

        res.status(200).json({ type: "success", message: "Product category updated successfully", data: category });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            type: "error",
            message: "Failed to update product category.",
        });
    }
};

const remove = async (req, res) => {
    try {
        // Soft delete category by setting isActive to false
        const category = await productCategory.update(Number(req.params.id), { isActive: false });

        res.status(200).json({
            type: "success",
            message: "Product category deactivated successfully.",
            data: category
        });
    } catch (err) {
        console.error(err);

        res.status(500).json({
            type: "error",
            message: "Failed to deactivate product category.",
        });
    }
};


const activate = async (req, res) => {
    try {
        const id = Number(req.params.id);

        const existing = await productCategory.getById(id);

        if (!existing) {
            return res.status(404).json({
                type: "error",
                message: "Product Category not found.",
            });
        }

        await productCategory.update(id, {
            isActive: true,
        });

        return res.json({
            type: "success",
            message: "Product Category activated successfully.",
        });
    } catch (err) {
        console.error(err);

        return res.status(500).json({
            type: "error",
            message: "Failed to activate product category.",
        });
    }
};


module.exports = {
    getAll,
    getById,
    create,
    update,
    remove,
    activate
};