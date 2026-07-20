const supplier = require("../models/supplier-model");
const ledgerModel = require("../models/ledger-model");

const getAllSuppliers = async (req, res) => {
    try {

        const page = Number(req.query.page || 1);
        const limit = Number(req.query.limit || 10);

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
                    phone: {
                        contains: req.query.search,
                    },
                },
            ];
        }

        if (req.query.isActive !== undefined) {
            where.isActive = req.query.isActive === "true";
        }

        const skip = (page - 1) * limit;

        const [suppliers, total] = await Promise.all([
            supplier.getAllSuppliers({ where, skip, take: limit }),
            supplier.countSuppliers(where),
        ]);
        res.json({
            type: "success",
            data: suppliers,
            total,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },

        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'error',
            message: "Failed to fetch suppliers"
        });
    }
}
const createSupplier = async (req, res) => {
    try {
        const data = await supplier.createSupplier(req.body);
        res.json({
            type: 'success',
            message: 'Supplier created successfully',
            data: data
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'error',
            message: "Failed to create supplier"
        });
    }
}
const getSupplierById = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                type: 'error',
                message: "Invalid supplier ID"
            });
        }
        const data = await supplier.getSupplierById(id);
        if (!data) {
            return res.status(404).json({
                type: 'error',
                message: "Supplier not found"
            });
        }
        res.json({
            type: 'success',
            message: 'Supplier fetched successfully',
            data: data
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'error',
            message: "Failed to fetch supplier"
        });
    }
};
const updateSupplier = async (req, res) => {
    try {
        const updateData = { ...req.body };
        delete updateData.balance;
        const data = await supplier.updateSupplier(req.params.id, updateData);
        res.json({
            type: 'success',
            message: 'Supplier updated successfully',
            data: data
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'error',
            message: "Failed to update supplier"
        });
    }
};
const deactivateSupplier = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                type: 'error',
                message: "Invalid supplier ID"
            });
        }
        const existing = await supplier.getSupplierById(id);
        if (!existing) {
            return res.status(404).json({
                type: 'error',
                message: "Supplier not found"
            });
        }
        const data = await supplier.deactivateSupplier(id);
        res.json({
            type: 'success',
            message: 'Supplier deactivated successfully',
            data: data
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'error',
            message: "Failed to deactivate supplier"
        });
    }
};
const activateSupplier = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                type: 'error',
                message: "Invalid supplier ID"
            });
        }
        const existing = await supplier.getSupplierById(id);
        if (!existing) {
            return res.status(404).json({
                type: 'error',
                message: "Supplier not found"
            });
        }
        const data = await supplier.activateSupplier(id);
        res.json({
            type: 'success',
            message: 'Supplier activated successfully',
            data: data
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'error',
            message: "Failed to activate supplier"
        });
    }
};

const getSupplierLedger = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ type: "error", message: "Invalid supplier ID" });
        }
        const entries = await supplier.getSupplierLedger(id);
        res.json({ type: "success", data: entries });
    } catch (err) {
        console.log(err);
        res.status(500).json({ type: "error", message: "Failed to fetch supplier ledger history" });
    }
};

const reconcileSupplierLedger = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ type: "error", message: "Invalid supplier ID" });
        }
        const result = await ledgerModel.reconcileSupplierLedger(id);
        res.json({ type: "success", data: result });
    } catch (err) {
        console.log(err);
        res.status(500).json({ type: "error", message: err.message || "Failed to reconcile supplier ledger" });
    }
};

module.exports = {
    getAllSuppliers,
    createSupplier,
    getSupplierById,
    updateSupplier,
    deactivateSupplier,
    activateSupplier,
    getSupplierLedger,
    reconcileSupplierLedger
};