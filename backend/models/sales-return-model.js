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
      const invItem = invoice.items.find(ii => ii.productId === item.productId);
      if (!invItem) {
        const error = new Error(`Product with ID ${item.productId} was not part of the original invoice.`);
        error.statusCode = 400;
        throw error;
      }

      const soldQty = invItem.quantity;
      const alreadyReturned = alreadyReturnedQtyMap[item.productId] || 0;
      const remaining = soldQty - alreadyReturned;

      if (item.quantity > remaining) {
        const error = new Error(
          `Return quantity for Product ID ${item.productId} (${item.quantity}) exceeds remaining returnable quantity (${remaining}).`
        );
        error.statusCode = 400;
        throw error;
      }

      const netUnitPrice = Number(invItem.totalPrice) / soldQty;
      const itemTotal = item.quantity * netUnitPrice;
      totalAmount += itemTotal;

      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: netUnitPrice,
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

    for (const item of validatedItems) {
      const invItem = invoice.items.find(ii => ii.productId === item.productId);
      const costPriceAtSale = invItem ? Number(invItem.costPriceAtSale) : 0;

      await tx.salesReturnItem.create({
        data: {
          salesReturnId: salesReturn.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          costPriceAtSale,
          totalPrice: item.totalPrice,
        },
      });

      // Lock product row to prevent concurrency errors
      const products = await tx.$queryRaw`
        SELECT "stockQuantity", "weightedAvgCost" FROM "Product" 
        WHERE id = ${item.productId} 
        FOR UPDATE
      `;
      const current = products[0];
      const existingQty = Number(current.stockQuantity);
      const existingWAC = Number(current.weightedAvgCost);
      const totalQty = existingQty + item.quantity;

      const newWAC =
        totalQty > 0
          ? (existingQty * existingWAC + item.quantity * costPriceAtSale) / totalQty
          : costPriceAtSale;

      await tx.product.update({
        where: { id: item.productId },
        data: { weightedAvgCost: Math.round(newWAC * 10000) / 10000 },
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

    // 7. Update invoice balanceDue and status to reflect the return.
    //    Applies to ALL refund types (CREDIT store-credit and CASH payout):
    //    - CREDIT: the credit note directly reduces what the customer owes on the invoice.
    //    - CASH:   we pay the customer back in cash, which equally cancels that portion of
    //              the receivable — the invoice should no longer show that debt.
    //    If the return amount exceeds balanceDue (e.g., invoice was already paid in full),
    //    the excess remains in Customer.balance as a negative (store credit) from the ledger
    //    entry above — the invoice is left at PAID / balanceDue = 0 unchanged.
    if (invoice.customerId && refundType === "CREDIT") {
      const appliedToInvoice = Math.min(totalAmount, Number(invoice.balanceDue));
      if (appliedToInvoice > 0) {
        const newBalanceDue = Math.max(0, Number(invoice.balanceDue) - appliedToInvoice);
        const newStatus =
          newBalanceDue <= 0
            ? "PAID"
            : newBalanceDue < Number(invoice.total)
            ? "PARTIALLY_PAID"
            : "UNPAID";

        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            balanceDue: newBalanceDue,
            status: newStatus,
            returnedAmount: { increment: appliedToInvoice }
          },
        });
      }
      // appliedToInvoice === 0 means invoice was already fully paid.
      // The ledger entries already handle the excess credit/cash obligation correctly.
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
              size: true,
              barcode: true,
            },
          },
        },
      },
      customer: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
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
