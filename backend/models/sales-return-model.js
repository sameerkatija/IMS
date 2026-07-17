const prisma = require("../config/prisma");
const stockModel = require("./stock-model");
const ledgerModel = require("./ledger-model");
const { generateDocNumber } = require("../config/doc-number");

/**
 * Creates a sales return transaction atomically.
 * Validates that returned quantities do not exceed original invoice quantities (minus already returned quantities).
 * Increments product stock levels and posts a credit entry in the customer ledger.
 */
async function createSalesReturn({ customerId, invoiceId, returnDate, reason, items, refundType = "CREDIT", createdById }) {
  return prisma.$transaction(async (tx) => {
    // 1. Verify invoice exists
    if (!invoiceId) {
      const error = new Error("Invoice ID is required to process a sales return.");
      error.statusCode = 400;
      throw error;
    }

    const invoice = await tx.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        items: true,
        salesReturns: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!invoice) {
      const error = new Error("Invoice not found.");
      error.statusCode = 404;
      throw error;
    }

    // Map original invoice items
    const soldQtyMap = {};
    const unitPriceMap = {};
    for (const invItem of invoice.items) {
      soldQtyMap[invItem.productId] = invItem.quantity;
      unitPriceMap[invItem.productId] = Number(invItem.unitPrice);
    }

    // Map already returned quantities
    const alreadyReturnedQtyMap = {};
    for (const ret of invoice.salesReturns) {
      for (const retItem of ret.items) {
        alreadyReturnedQtyMap[retItem.productId] =
          (alreadyReturnedQtyMap[retItem.productId] || 0) + retItem.quantity;
      }
    }

    // 2. Validate items to return and compute total credit refund amount
    let totalAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      const soldQty = soldQtyMap[item.productId];
      if (soldQty === undefined) {
        const error = new Error(`Product with ID ${item.productId} was not part of the original invoice.`);
        error.statusCode = 400;
        throw error;
      }

      const alreadyReturned = alreadyReturnedQtyMap[item.productId] || 0;
      const remaining = soldQty - alreadyReturned;

      if (item.quantity > remaining) {
        const error = new Error(
          `Return quantity for Product ID ${item.productId} (${item.quantity}) exceeds remaining returnable quantity (${remaining}).`
        );
        error.statusCode = 400;
        throw error;
      }

      // Default unitPrice to original invoice's unitPrice or current sellingPrice
      const unitPrice = item.unitPrice !== undefined && item.unitPrice !== null ? item.unitPrice : unitPriceMap[item.productId];
      const itemTotal = item.quantity * unitPrice;
      totalAmount += itemTotal;

      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        totalPrice: itemTotal,
      });
    }

    // 3. Generate unique sequential return number (SR-XXXXXX)
    const returnNo = await generateDocNumber(tx, "salesReturn", "SR");

    // 4. Create Sales Return record
    const salesReturn = await tx.salesReturn.create({
      data: {
        returnNo,
        customerId: invoice.customerId, // Inherit customer from original invoice
        invoiceId,
        returnDate: returnDate ? new Date(returnDate) : new Date(),
        totalAmount,
        refundType,
        reason,
        createdById,
      },
    });

    // 5. Create SalesReturnItems and run stock engine IN movements
    for (const item of validatedItems) {
      await tx.salesReturnItem.create({
        data: {
          salesReturnId: salesReturn.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        },
      });

      // Adjust stock (incrementing stock back in)
      await stockModel.adjustStock(
        {
          productId: item.productId,
          quantity: item.quantity,
          type: "IN",
          referenceType: "SALES_RETURN",
          referenceId: salesReturn.id,
          description: reason || `Sales Return ${returnNo}`,
          createdById,
        },
        tx
      );
    }

    // 6. Record customer ledger entries if totalAmount > 0 and customer exists
    if (totalAmount > 0 && invoice.customerId) {
      // 6a. Record customer credit ledger entry (goods return reduces what they owe us)
      await ledgerModel.recordCustomerLedgerEntry(
        {
          customerId: invoice.customerId,
          debit: 0,
          credit: totalAmount,
          referenceType: "SALES_RETURN",
          referenceId: salesReturn.id,
          description: `Sales Return ${returnNo} for Invoice ${invoice.invoiceNo}`,
        },
        tx
      );

      // 6b. If refundType is CASH, immediately offset the credit with a debit entry (represents the cash paid back to customer)
      if (refundType === "CASH") {
        await ledgerModel.recordCustomerLedgerEntry(
          {
            customerId: invoice.customerId,
            debit: totalAmount,
            credit: 0,
            referenceType: "SALES_RETURN",
            referenceId: salesReturn.id,
            description: `Cash Refund for Sales Return ${returnNo}`,
          },
          tx
        );
      }
    }

    return salesReturn;
  });
}

/**
 * Returns all sales returns matching filters, ordered by creation desc.
 */
function getAllSalesReturns({ where, skip, take }) {
  return prisma.salesReturn.findMany({
    where,
    skip,
    take,
    include: {
      customer: {
        select: {
          name: true,
        },
      },
      invoice: {
        select: {
          invoiceNo: true,
        },
      },
      _count: {
        select: {
          items: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Counts total sales returns matching criteria.
 */
function countSalesReturns(where) {
  return prisma.salesReturn.count({ where });
}

/**
 * Fetches a single sales return details by ID.
 */
function getSalesReturnById(id) {
  return prisma.salesReturn.findUnique({
    where: { id: Number(id) },
    include: {
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              barcode: true,
            },
          },
        },
      },
      customer: true,
      invoice: {
        select: {
          id: true,
          invoiceNo: true,
          invoiceDate: true,
        },
      },
    },
  });
}

module.exports = {
  createSalesReturn,
  getAllSalesReturns,
  countSalesReturns,
  getSalesReturnById,
};
