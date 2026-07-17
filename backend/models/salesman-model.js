const prisma = require('../config/prisma');

const getAllSalesman = ({ where = {}, skip = 0, take = 10 }) => {
    return prisma.salesman.findMany({
        where,
        skip,
        take,
        orderBy: {
            createdAt: "desc",
        },
    });
};

const countSalesman = (where = {}) => {
    return prisma.salesman.count({
        where,
    });
};


const getSalesmanById = async (id) => {

    return await prisma.salesman.findUnique({
        where: {
            id: Number(id)
        }
    });
};
const createSalesman = async (data) => {
    return await prisma.salesman.create({
        data
    });
};
const updateSalesman = async (id, data) => {
    return await prisma.salesman.update({
        where: {
            id: Number(id)
        },
        data
    });
};


const deactivateSalesman = async (id) => {
    return await prisma.salesman.update({
        where: {
            id: Number(id)
        },
        data: {
            isActive: false
        }
    });
};
const activateSalesman = async (id) => {
    return await prisma.salesman.update({
        where: {
            id: Number(id)
        },
        data: {
            isActive: true
        }
    });
};

module.exports = {
    getAllSalesman,
    countSalesman,
    getSalesmanById,
    createSalesman,
    updateSalesman,
    deactivateSalesman,
    activateSalesman
}