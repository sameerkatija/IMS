const prisma = require("../config/prisma");

const getAll = ({ where, skip, take }) => {
    return prisma.product.findMany({
        where,
        skip,
        take,
        include: {
            category: true,
        },
        orderBy: {
            createdAt: "desc", // Shows the most recent products first
        },
    });
};

const count =  (where) => {
  return prisma.product.count({ where });
}

const getById =  (id) => {
    return prisma.product.findUnique({
        where: { id },
        include: {
            category: true,
        },
    });
};

const getBySKU =  (sku) => {
    return prisma.product.findUnique({
        where: { sku },
        include: {
            category: true,
        },
    });
}

const getBybarCode =  (barcode) => {
    return prisma.product.findUnique({
        where: { barcode },
        include: {
            category: true,
        },
    });
}

// Prisma's query builder can't compare two columns of the same row
// (stockQuantity <= lowStockLevel) in a standard `where` filter, so this
// one case needs a raw query. Kept isolated here so the rest of the
// repository stays plain Prisma calls.
async function findLowStock({ skip, take }) {
  return prisma.$queryRaw`
    SELECT p.*, c.name as "categoryName"
    FROM "Product" p
    JOIN "Category" c ON c.id = p."categoryId"
    WHERE p."isActive" = true AND p."stockQuantity" <= p."lowStockLevel"
    ORDER BY (p."stockQuantity" - p."lowStockLevel") ASC
    OFFSET ${skip} LIMIT ${take}
  `;
}

async function countLowStock() {
  const result = await prisma.$queryRaw`
    SELECT COUNT(*)::int as count
    FROM "Product"
    WHERE "isActive" = true AND "stockQuantity" <= "lowStockLevel"
  `;
  return result[0].count;
}


const create =  (data) => {
    return prisma.product.create({
        data,
        include: {
            category: true,
        },
    });
};

const update =  (id, data) => {
    return prisma.product.update({
        where: { id },
        data,
        include: {
            category: true,
        },
    });
};

// const remove =  (id) => {
//     return prisma.product.delete({
//         where: { id },
//     });
// };

module.exports = {
    getAll,
    getById,
    getBySKU,
    getBybarCode,
    findLowStock,
    countLowStock,
    count,
    create,
    update
};