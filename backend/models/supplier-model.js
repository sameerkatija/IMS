const prisma = require('../config/prisma');

const getAllSuppliers = ({ where = {}, skip = 0, take = 10 }) => {
    return prisma.supplier.findMany({
        where,
        skip,
        take,
        orderBy: {
            createdAt: "desc",
        },
    });
};

const countSuppliers = (where = {}) => {
    return prisma.supplier.count({
        where,
    });
};


const getSupplierById = async (id) => {

    return await prisma.supplier.findUnique({
        where: {
            id: Number(id)
        }
    });
};
const createSupplier = async (data) => {
    return await prisma.supplier.create({
        data
    });
};
const updateSupplier = async (id, data) => {
    return await prisma.supplier.update({
        where: {
            id: Number(id)
        },
        data
    });
};


const deactivateSupplier = async (id) => {
    return await prisma.supplier.update({
        where: {
            id: Number(id)
        },
        data: {
            isActive: false
        }
    });
};
const activateSupplier = async (id) => {
    return await prisma.supplier.update({
        where: {
            id: Number(id)
        },
        data: {
            isActive: true
        }
    });
};

const getSupplierLedger = (supplierId) => {
    return prisma.supplierLedger.findMany({
        where: { supplierId: Number(supplierId) },
        orderBy: { createdAt: "asc" }
    });
};

module.exports = {
    getAllSuppliers,
    countSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deactivateSupplier,
    activateSupplier,
    getSupplierLedger
}