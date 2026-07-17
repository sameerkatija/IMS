const prisma = require('../config/prisma');

const getAllCustomers = ({ where = {}, skip = 0, take = 10 }) => {
    return prisma.customer.findMany({
        where,
        skip,
        take,
        orderBy: {
            createdAt: "desc",
        },
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