const customer = require("../models/customer-model");

const getAllCustomers = async (req, res) => {
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

        const [customers, total] = await Promise.all([
            customer.getAllCustomers({ where, skip, take: limit }),
            customer.countCustomers(where),
        ]);
        res.json({
            type: "success",
            data: customers,
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
            message: "Failed to fetch customers"
        });
    }
}
const createCustomer = async (req, res) => {
    try {
        const data = await customer.createCustomer(req.body);
        res.json({
            type: 'success',
            message: 'Customer created successfully',
            data: data
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'error',
            message: "Failed to create customer"
        });
    }
}
const getCustomerById = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                type: 'error',
                message: "Invalid customer ID"
            });
        }
        const data = await customer.getCustomerById(id);
        if (!data) {
            return res.status(404).json({
                type: 'error',
                message: "Customer not found"
            });
        }
        res.json({
            type: 'success',
            message: 'Customer fetched successfully',
            data: data
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'error',
            message: "Failed to fetch customer"
        });
    }
};
const updateCustomer = async (req, res) => {
    try {
        const data = await customer.updateCustomer(req.params.id, req.body);
        res.json({
            type: 'success',
            message: 'Customer updated successfully',
            data: data
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'error',
            message: "Failed to update customer"
        });
    }
};
const deactivateCustomer = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                type: 'error',
                message: "Invalid Customer ID"
            });
        }
        const existing = await customer.getCustomerById(id);
        if (!existing) {
            return res.status(404).json({
                type: 'error',
                message: "Customer not found"
            });
        }
        const data = await customer.deactivateCustomer(id);
        res.json({
            type: 'success',
            message: 'Customer deactivated successfully',
            data: data
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'error',
            message: "Failed to deactivate customer"
        });
    }
};
const activateCustomer = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                type: 'error',
                message: "Invalid Customer ID"
            });
        }
        const existing = await customer.getCustomerById(id);
        if (!existing) {
            return res.status(404).json({
                type: 'error',
                message: "Customer not found"
            });
        }
        const data = await customer.activateCustomer(id);
        res.json({
            type: 'success',
            message: 'Customer activated successfully',
            data: data
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'error',
            message: "Failed to activate customer"
        });
    }
};

const getCustomerLedger = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ type: "error", message: "Invalid customer ID" });
        }
        const entries = await customer.getCustomerLedger(id);
        res.json({ type: "success", data: entries });
    } catch (err) {
        console.log(err);
        res.status(500).json({ type: "error", message: "Failed to fetch customer ledger history" });
    }
};

module.exports = {
    getAllCustomers,
    createCustomer,
    getCustomerById,
    updateCustomer,
    deactivateCustomer,
    activateCustomer,
    getCustomerLedger
}