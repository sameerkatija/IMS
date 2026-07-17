const prisma = require("../config/prisma");

const getAll = ({ month }) => {
    const where = {};

    if (month) {
        where.month = new Date(month);
    }
    return prisma.salesTarget.findMany({
        where,
        include: {
            salesman: true,
            createdBy: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                },

            },
        },
        orderBy: {
            month: "desc",
        },
    });
};

const getById = (id) => {
    return prisma.salesTarget.findUnique({
        where: {
            id: Number(id),
        },
        include: {
            salesman: true,
            createdBy: true,
        },
    });
};


const findBySalesmanId = (salesmanId) => {
    return prisma.salesTarget.findMany({
        where: {
            salesmanId: salesmanId,
        },
        include: {
            salesman: true,
            createdBy: {
                select: {
                    id: true,
                    name: true,
                    username: true,
                },
            },
        },
        orderBy: {
            month: "desc",
        },
    },
    )
}



const findBySalesmanAndMonth = (salesmanId, month) => {
    return prisma.salesTarget.findUnique({
        where: {
            salesmanId_month: {
                salesmanId,
                month,
            },
        },
    });
};

const create = (data) => {
    return prisma.salesTarget.create({
        data,
        include: {
            salesman: true,
            createdBy: true,
        },
    });
};

const update = (id, data) => {
    return prisma.salesTarget.update({
        where: {
            id: Number(id),
        },
        data,
        include: {
            salesman: true,
            createdBy: true,
        },
    });
};

const remove = (id) => {
    return prisma.salesTarget.delete({
        where: {
            id: Number(id),
        },
    });
};

async function setTarget(salesmanId, { month, targetAmount, description, createdById }) {
  const monthDate = new Date(`${month}-01T00:00:00Z`);

  return prisma.salesTarget.upsert({
    where: {
      salesmanId_month: {
        salesmanId: Number(salesmanId),
        month: monthDate,
      },
    },
    update: {
      targetAmount,
      description,
      createdById: Number(createdById),
    },
    create: {
      salesmanId: Number(salesmanId),
      month: monthDate,
      targetAmount,
      description,
      createdById: Number(createdById),
    },
    include: {
      salesman: true,
      createdBy: {
        select: { id: true, name: true, username: true },
      },
    },
  });
}

function listTargets(salesmanId) {
  return prisma.salesTarget.findMany({
    where: { salesmanId: Number(salesmanId) },
    include: {
      createdBy: {
        select: { id: true, name: true, username: true },
      },
    },
    orderBy: {
      month: "desc",
    },
  });
}

async function getAchievement(salesmanId, monthStr) {
  const monthStart = new Date(`${monthStr}-01T00:00:00Z`);
  const monthEnd = new Date(monthStart);
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1);

  const salesman = await prisma.salesman.findUnique({
    where: { id: Number(salesmanId) },
  });
  if (!salesman) {
    const error = new Error("Salesman not found.");
    error.statusCode = 404;
    throw error;
  }

  const [target, grossSalesAgg, returnsAgg] = await Promise.all([
    prisma.salesTarget.findUnique({
      where: {
        salesmanId_month: {
          salesmanId: Number(salesmanId),
          month: monthStart,
        },
      },
    }),
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: {
        salesmanId: Number(salesmanId),
        invoiceDate: { gte: monthStart, lt: monthEnd },
      },
    }),
    prisma.salesReturn.aggregate({
      _sum: { totalAmount: true },
      where: {
        invoice: { salesmanId: Number(salesmanId) },
        returnDate: { gte: monthStart, lt: monthEnd },
      },
    }),
  ]);

  const targetAmount = target ? Number(target.targetAmount) : 0;
  const grossSales = Number(grossSalesAgg._sum.total || 0);
  const returns = Number(returnsAgg._sum.totalAmount || 0);
  const actualSales = grossSales - returns;
  const achievedPercent = targetAmount > 0 ? Number(((actualSales / targetAmount) * 100).toFixed(2)) : null;

  return {
    salesmanId: Number(salesmanId),
    salesmanName: salesman.name,
    month: monthStr,
    targetAmount,
    grossSales,
    returns,
    actualSales,
    achievedPercent,
  };
}

module.exports = {
    getAll,
    getById,
    findBySalesmanAndMonth,
    create,
    update,
    remove,
    findBySalesmanId,
    setTarget,
    listTargets,
    getAchievement,
};