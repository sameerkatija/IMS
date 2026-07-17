const prisma = require("../config/prisma");

const getAll = (filters = {}) => {
    return prisma.category.findMany({
        where: filters,
        orderBy: {
            name: "asc",
        },
    });
};


const getById = (id) => {
    return prisma.category.findUnique({
        where: { id },
    });
};

const getByName = (name) => {
    return prisma.category.findFirst({
        where: { name },
    });
}

const create = (data) => {
    return prisma.category.create({
        data,
    });
};

const update = (id, data) => {
    return prisma.category.update({
        where: { id },
        data,
    });
};

const remove = (id) => {
    return prisma.category.delete({
        where: { id },
    });
};

module.exports = {
    getAll,
    getById,
    getByName,
    create,
    update,
    remove,
};