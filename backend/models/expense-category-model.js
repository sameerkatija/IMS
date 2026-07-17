const prisma = require("../config/prisma");

const getAll = (filters = {}) => {
    return prisma.expenseCategory.findMany({
        where: filters,
        orderBy: {
            name: "asc",
        },
    });
};


const getById =  (id) => {
    return prisma.expenseCategory.findUnique({
        where: { id },
    });
};

const getByName =  (name) => {
    return prisma.expenseCategory.findFirst({
        where: { name },
    });
}

const create =  (data) => {
    return prisma.expenseCategory.create({
        data,
    });
};

const update =  (id, data) => {
    return prisma.expenseCategory.update({
        where: { id },
        data,
    });
};

const remove =  (id) => {
    return prisma.expenseCategory.delete({
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