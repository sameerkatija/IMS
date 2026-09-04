const prisma = require('../config/prisma');

const getAllCustomers = ({ where = {}, skip = 0, take = 50000, orderBy = { createdAt: "desc" } } = {}) => {
    const safeSkip = typeof skip === "number" && !isNaN(skip) && skip >= 0 ? skip : 0;
    const safeTake = typeof take === "number" && !isNaN(take) && take > 0 ? take : 50000;
    return prisma.customer.findMany({
        where,
        skip: safeSkip,
        take: safeTake,
        orderBy,
    });
};

const countCustomers = (where = {}) => {
    return prisma.customer.count({
        where,
    });
};


const getCustomerById = async (id) => {

    return await prisma.customer.findUnique({
        where: {
            id: Number(id)
        }
    });
};
const createCustomer = async (data) => {
    return await prisma.customer.create({
        data
    });
};
const updateCustomer = async (id, data) => {
    return await prisma.customer.update({
        where: {
            id: Number(id)
        },
        data
    });
};


const deactivateCustomer = async (id) => {
    return await prisma.customer.update({
        where: {
            id: Number(id)
        },
        data: {
            isActive: false
        }
    });
};
const activateCustomer = async (id) => {
    return await prisma.customer.update({
        where: {
            id: Number(id)
        },
        data: {
            isActive: true
        }
    });
};

const getCustomerLedger = (customerId) => {
    return prisma.customerLedger.findMany({
        where: { customerId: Number(customerId) },
        orderBy: { createdAt: "asc" }
    });
};

module.exports = {
    getAllCustomers,
    countCustomers,
    getCustomerById,
    createCustomer,
    updateCustomer,
    deactivateCustomer,
    activateCustomer,
    getCustomerLedger
}