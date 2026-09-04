const customer = require("../models/customer-model");
const ledgerModel = require("../models/ledger-model");

const getAllCustomers = async (req, res) => {
    try {

        const isAll = req.query.limit === "all";
        const page = Math.max(1, Number(req.query.page) || 1);
        const limit = isAll ? 50000 : Math.max(1, Number(req.query.limit) || 10);
        const skip = isAll ? 0 : (page - 1) * limit;

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

        if (req.query.balanceFilter) {
            if (req.query.balanceFilter === "oweUs") {
                where.balance = { gt: 0 };
            } else if (req.query.balanceFilter === "weOwe") {
                where.balance = { lt: 0 };
            } else if (req.query.balanceFilter === "zero") {
                where.balance = 0;
            }
        }

        const skip = req.query.limit === "all" ? 0 : (page - 1) * limit;
        const orderBy = req.query.sortBy === "name" 
            ? { name: "asc" } 
            : { createdAt: "desc" };

        const [customers, total] = await Promise.all([
            customer.getAllCustomers({ where, skip, take: limit, orderBy }),
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
        const updateData = { ...req.body };
        delete updateData.balance;
        const data = await customer.updateCustomer(req.params.id, updateData);
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

const reconcileCustomerLedger = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({ type: "error", message: "Invalid customer ID" });
        }
        const result = await ledgerModel.reconcileCustomerLedger(id);
        res.json({ type: "success", data: result });
    } catch (err) {
        console.log(err);
        res.status(500).json({ type: "error", message: err.message || "Failed to reconcile customer ledger" });
    }
};

module.exports = {
    getAllCustomers,
    createCustomer,
    getCustomerById,
    updateCustomer,
    deactivateCustomer,
    activateCustomer,
    getCustomerLedger,
    reconcileCustomerLedger
};