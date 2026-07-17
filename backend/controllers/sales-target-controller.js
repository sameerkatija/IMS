const salesTarget = require("../models/sales-target-model");
const salesman = require("../models/salesman-model");

const getAll = async (req, res) => {
    try {
        const month = req.query.month;
        const targets = await salesTarget.getAll({ month });

        res.json({
            type: "success",
            message: "Successfully retrieved Sales Targets.",
            data: targets,
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            type: "error",
            message: "Error getting Sales Targets.",
        });
    }
};

const getById = async (req, res) => {

    try {
        const id = Number(req.params.id);
        if (isNaN(id)) {
            res.json({
                type: "error",
                message: "Invalid Sales Target ID.",
            })
        }
        const target = await salesTarget.getById(req.params.id);

        if (!target) {
            return res.status(404).json({
                type: "error",
                message: "Target not found.",
            });
        }

        res.json({
            type: "success",
            message: "Successfully retrieved Sales Target.",
            data: target,
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            type: "error",
            message: "Error getting Sales Target.",
        });
    }

};

const create = async (req, res) => {

    try {

        const salesmanExists = await salesman.getSalesmanById(req.body.salesmanId);
        if (!salesmanExists) {

            return res.status(404).json({
                type: "error",
                message: "Salesman not found.",
            });

        }
        if (!salesmanExists.isActive) {
            return res.status(400).json({
                type: "error",
                message: "Cannot assign a target to an inactive salesman.",
            });
        }

        const month = new Date(`${req.body.month}-01`);

        const existing = await salesTarget.findBySalesmanAndMonth(
            req.body.salesmanId,
            month
        );

        if (existing) {

            return res.status(400).json({
                type: "error",
                message: "Target already exists for this month.",
            });

        }

        const target = await salesTarget.create({
            salesmanId: req.body.salesmanId,
            month,
            targetAmount: req.body.targetAmount,
            description: req.body.description,
            createdById: req.user.id,
        });

        res.status(201).json({
            type: "success",
            message: "Sales target created successfully.",
            data: target,
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            type: "error",
            message: "Error creating Sales Target.",
        });

    }

};

const update = async (req, res) => {

    try {

        const target = await salesTarget.getById(req.params.id);

        if (!target) {

            return res.status(404).json({
                type: "error",
                message: "Target not found.",
            });

        }

        const updated = await salesTarget.update(req.params.id, {
            targetAmount: req.body.targetAmount,
            description: req.body.description,
            createdById: req.user.id,
        });

        res.json({
            type: "success",
            message: "Sales target updated.",
            data: updated,
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            type: "error",
            message: err.message,
        });

    }

};

const remove = async (req, res) => {

    try {

        await salesTarget.remove(req.params.id);

        res.json({
            type: "success",
            message: "Sales target deleted.",
        });

    } catch (err) {

        console.error(err);

        res.status(500).json({
            type: "error",
            message: err.message,
        });

    }

};

const setTarget = async (req, res) => {
    try {
        const salesmanId = Number(req.params.id);
        const { month, targetAmount, description } = req.body;
        const createdById = req.user.id;

        const target = await salesTarget.setTarget(salesmanId, {
            month,
            targetAmount,
            description,
            createdById,
        });

        res.status(200).json({
            type: "success",
            message: "Sales target upserted successfully.",
            data: target,
        });
    } catch (err) {
        console.error(err);
        res.status(err.statusCode || 500).json({
            type: "error",
            message: err.message || "Error setting Sales Target.",
        });
    }
};

const listTargets = async (req, res) => {
    try {
        const salesmanId = Number(req.params.id);
        const targets = await salesTarget.listTargets(salesmanId);

        res.status(200).json({
            type: "success",
            data: targets,
        });
    } catch (err) {
        console.error(err);
        res.status(err.statusCode || 500).json({
            type: "error",
            message: err.message || "Error listing Sales Targets.",
        });
    }
};

const getAchievement = async (req, res) => {
    try {
        const salesmanId = Number(req.params.id);
        const { month } = req.query; // expects month query parameter e.g., ?month=2026-07

        if (!month) {
            return res.status(400).json({
                type: "error",
                message: "Month query parameter is required in format YYYY-MM.",
            });
        }

        const achievement = await salesTarget.getAchievement(salesmanId, month);

        res.status(200).json({
            type: "success",
            data: achievement,
        });
    } catch (err) {
        console.error(err);
        res.status(err.statusCode || 500).json({
            type: "error",
            message: err.message || "Error checking Sales Target achievement.",
        });
    }
};

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove,
    setTarget,
    listTargets,
    getAchievement,
};