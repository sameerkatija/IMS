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

const getCustomerLedger = async (customerId) => {
    const entries = await prisma.customerLedger.findMany({
        where: { customerId: Number(customerId) },
        orderBy: { createdAt: "asc" }
    });

    const invoiceIds = entries.filter(e => e.referenceType === "INVOICE").map(e => e.referenceId);
    const returnIds = entries.filter(e => e.referenceType === "RETURN").map(e => e.referenceId);

    const [invoices, returns] = await Promise.all([
        invoiceIds.length > 0
            ? prisma.invoice.findMany({ where: { id: { in: invoiceIds } }, select: { id: true, invoiceNo: true } })
            : [],
        returnIds.length > 0
            ? prisma.salesReturn.findMany({ where: { id: { in: returnIds } }, select: { id: true, returnNo: true } })
            : []
    ]);

    const invoiceMap = new Map(invoices.map(i => [i.id, i.invoiceNo]));
    const returnMap = new Map(returns.map(r => [r.id, r.returnNo]));

    return entries.map(entry => {
        let referenceDocNo = null;
        let displayDocNo = null;

        if (entry.referenceType === "INVOICE") {
            referenceDocNo = invoiceMap.get(entry.referenceId);
            if (!referenceDocNo && entry.description) {
                const match = entry.description.match(/INV-\d+/i);
                if (match) referenceDocNo = match[0];
            }
            if (referenceDocNo) {
                const numMatch = referenceDocNo.match(/INV-0*(\d+)/i);
                displayDocNo = numMatch ? numMatch[1] : referenceDocNo;
            }
        } else if (entry.referenceType === "RETURN") {
            referenceDocNo = returnMap.get(entry.referenceId);
            if (!referenceDocNo && entry.description) {
                const match = entry.description.match(/RET-\d+/i);
                if (match) referenceDocNo = match[0];
            }
            if (referenceDocNo) {
                const numMatch = referenceDocNo.match(/RET-0*(\d+)/i);
                displayDocNo = numMatch ? numMatch[1] : referenceDocNo;
            }
        }

        return {
            ...entry,
            referenceDocNo,
            displayDocNo
        };
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