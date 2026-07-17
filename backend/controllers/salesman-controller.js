const salesman = require("../models/salesman-model");
const salesTarget = require("../models/sales-target-model")
const getAllSalesmans = async (req, res) => {
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

        const [salesmans, total] = await Promise.all([
            salesman.getAllSalesman({ where, skip, take: limit }),
            salesman.countSalesman(where),
        ]);
        res.json({
            type: "success",
            data: salesmans,
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
            message: "Failed to fetch Salesman"
        });
    }
}
const createSalesman = async (req, res) => {
    try {
        const data = await salesman.createSalesman(req.body);
        res.json({
            type: 'success',
            message: 'Salesman created successfully',
            data: data
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'error',
            message: "Failed to create salesman"
        });
    }
}
const getSalesmanById = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                type: 'error',
                message: "Invalid salesman ID"
            });
        }
        const data = await salesman.getSalesmanById(id);
        if (!data) {
            return res.status(404).json({
                type: 'error',
                message: "Salesman not found"
            });
        }
        res.json({
            type: 'success',
            message: 'Salesman fetched successfully',
            data: data
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'error',
            message: "Failed to fetch Salesman"
        });
    }
};
const updateSalesman = async (req, res) => {
    try {
        const data = await salesman.updateSalesman(req.params.id, req.body);
        res.json({
            type: 'success',
            message: 'Salesman updated successfully',
            data: data
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'error',
            message: "Failed to update Salesman"
        });
    }
};
const deactivateSalesman = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                type: 'error',
                message: "Invalid salesman ID"
            });
        }
        const existing = await salesman.getSalesmanById(id);
        if (!existing) {
            return res.status(404).json({
                type: 'error',
                message: "Salesman not found"
            });
        }
        const data = await salesman.deactivateSalesman(id);
        res.json({
            type: 'success',
            message: 'Salesman deactivated successfully',
            data: data
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'error',
            message: "Failed to deactivate Salesman"
        });
    }
};
const activateSalesman = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                type: 'error',
                message: "Invalid Salesman ID"
            });
        }
        const existing = await salesman.getSalesmanById(id);
        if (!existing) {
            return res.status(404).json({
                type: 'error',
                message: "Salesman not found"
            });
        }
        const data = await salesman.activateSalesman(id);
        res.json({
            type: 'success',
            message: 'Salesman activated successfully',
            data: data
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'error',
            message: "Failed to activate Salesman"
        });
    }
};

const getSalesmanTargets = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            return res.status(400).json({
                type: 'error',
                message: "Invalid salesman ID"
            });
        }
        const existing = await salesman.getSalesmanById(id);
        if (!existing) {
            return res.status(404).json({
                type: 'error',
                message: "Salesman not found"
            });
        }
        const targets = await salesTarget.findBySalesmanId(id);
        res.json({
            type: 'success',
            message: 'Salesman targets fetched successfully',
            data: targets
        });
    } catch (err) {
        console.log(err);
        res.status(500).json({
            type: 'error',
            message: "Failed to fetch Salesman targets"
        });
    }
}


module.exports = {
    getAllSalesmans,
    createSalesman,
    getSalesmanById,
    updateSalesman,
    deactivateSalesman,
    activateSalesman,
    getSalesmanTargets
}