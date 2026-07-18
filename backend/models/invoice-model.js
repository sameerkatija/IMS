const prisma = require("../config/prisma");
const stockModel = require("./stock-model");
const ledgerModel = require("./ledger-model");
const { generateDocNumber } = require("../config/doc-number");

/**
 * Creates a sales invoice transaction atomically.
 * Automatically decrements inventory levels, records salesman targets, log customer payments,
 * and updates the customer's ledger/balance if there's any credit component.
 */
async function createInvoice({ customerId, salesmanId, saleType = "CASH", invoiceDate, discount = 0, paidAmount = 0, creditApplied = 0, description, items, createdById }) {
  return prisma.$transaction(async (tx) => {
    // 1. Validate customer exists (if customerId is provided) and check credit limits
    if (customerId) {
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        const error = new Error("Customer not found.");
        error.statusCode = 404;
        throw error;
      }

      if (creditApplied > 0) {
        const availableCredit = customer.balance < 0 ? Math.abs(Number(customer.balance)) : 0;
        if (creditApplied > availableCredit) {
          const error = new Error(`Applied credit (${creditApplied}) cannot exceed customer's available credit (${availableCredit}).`);
          error.statusCode = 400;
          throw error;
        }
      }
    } else {
      if (creditApplied > 0) {
        const error = new Error("Customer is required when applying credit.");
        error.statusCode = 400;
        throw error;
      }
    }

    // 2. Validate salesman exists and is active (if salesmanId is provided)
    if (salesmanId) {
      const salesman = await tx.salesman.findUnique({ where: { id: salesmanId } });
      if (!salesman) {
        const error = new Error("Salesman not found.");
        error.statusCode = 404;
        throw error;
      }
      if (!salesman.isActive) {
        const error = new Error("Cannot assign invoice to an inactive salesman.");
        error.statusCode = 400;
        throw error;
      }
    }

    // 3. Loop and validate items, calculate subtotal, and snapshot cost prices at sale
    let subtotal = 0;
    let totalCost = 0;
    const validatedItems = [];

    for (const item of items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) {
        const error = new Error(`Product with ID ${item.productId} not found.`);
        error.statusCode = 404;
        throw error;
      }

      // Default unitPrice to product's current sellingPrice if not overridden in payload
      const unitPrice = item.unitPrice !== undefined && item.unitPrice !== null ? item.unitPrice : Number(product.sellingPrice);
      const totalPrice = item.quantity * unitPrice;
      subtotal += totalPrice;
      totalCost += item.quantity * Number(product.costPrice);

      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        costPriceAtSale: Number(product.costPrice),
        totalPrice,
      });
    }

    // 4. Calculate invoice totals and outstanding balance due
    const total = subtotal - discount;
    if (total < totalCost) {
      const error = new Error(`Invoice discount is too high. Net total (Rs. ${total.toFixed(2)}) cannot go below the total cost price of the items (Rs. ${totalCost.toFixed(2)}).`);
      error.statusCode = 400;
      throw error;
    }

    if (paidAmount < 0) {
      const error = new Error("Paid amount cannot be negative.");
      error.statusCode = 400;
      throw error;
    }

    if (creditApplied < 0) {
      const error = new Error("Applied credit cannot be negative.");
      error.statusCode = 400;
      throw error;
    }

    if (paidAmount + creditApplied > total) {
      const error = new Error("Sum of paid amount and credit applied cannot exceed invoice total.");
      error.statusCode = 400;
      throw error;
    }

    const balanceDue = total - paidAmount - creditApplied;

    // Enforce business rules & constraints
    if (saleType === "CREDIT" && !customerId) {
      const error = new Error("Customer is required for credit sales.");
      error.statusCode = 400;
      throw error;
    }

    if (balanceDue > 0 && !customerId) {
      const error = new Error("Customer is required when there is an outstanding balance due.");
      error.statusCode = 400;
      throw error;
    }

    // 5. Generate unique sequential invoice number
    const invoiceNo = await generateDocNumber(tx, "invoice", "INV");
    const status = (paidAmount + creditApplied) >= total ? "PAID" : ((paidAmount + creditApplied) > 0 ? "PARTIALLY_PAID" : "UNPAID");

    // 6. Create the Invoice record
    const invoice = await tx.invoice.create({
      data: {
        invoiceNo,
        customerId,
        salesmanId,
        saleType,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        subtotal,
        discount,
        total,
        paidAmount,
        creditApplied,
        balanceDue,
        status,
        description,
        createdById,
      },
    });

    // 7. Save line items and trigger stock engine updates (OUT movements)
    for (const item of validatedItems) {
      await tx.invoiceItem.create({
        data: {
          invoiceId: invoice.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          costPriceAtSale: item.costPriceAtSale,
          totalPrice: item.totalPrice,
        },
      });

      // Deduct product stock atomically using stock engine
      await stockModel.adjustStock(
        {
          productId: item.productId,
          quantity: item.quantity,
          type: "OUT",
          referenceType: "INVOICE",
          referenceId: invoice.id,
          description: `Invoice ${invoiceNo}`,
          createdById,
        },
        tx
      );
    }

    // 8. If paidAmount > 0 and customer is present, log counter Payment
    if (paidAmount > 0 && customerId) {
      await tx.customerPayment.create({
        data: {
          customerId,
          invoiceId: invoice.id,
          amount: paidAmount,
          paymentDate: invoice.invoiceDate,
          description: `Cash paid upfront for Invoice ${invoiceNo}`,
          createdById,
        },
      });
    }

    // 9. Post ledger entries (only for credit sales or when store credit is applied)
    if (customerId && (saleType === "CREDIT" || creditApplied > 0)) {
      const ledgerDebit = total;
      if (ledgerDebit > 0) {
        await ledgerModel.recordCustomerLedgerEntry(
          {
            customerId,
            debit: ledgerDebit,
            credit: 0,
            referenceType: "INVOICE",
            referenceId: invoice.id,
            description: `Credit sale for Invoice ${invoiceNo}`,
          },
          tx
        );
      }

      if (paidAmount > 0) {
        await ledgerModel.recordCustomerLedgerEntry(
          {
            customerId,
            debit: 0,
            credit: paidAmount,
            referenceType: "INVOICE",
            referenceId: invoice.id,
            description: `Cash payment upfront for Invoice ${invoiceNo}`,
          },
          tx
        );
      }
    }

    return invoice;
  });
}

/**
 * Returns all invoices matching filters, ordered by creation date desc.
 */
function getAllInvoices({ where, skip, take }) {
  return prisma.invoice.findMany({
    where,
    skip,
    take,
    include: {
      customer: {
        select: {
          name: true,
        },
      },
      salesman: {
        select: {
          name: true,
        },
      },
      items: {
        select: {
          quantity: true,
          unitPrice: true,
          costPriceAtSale: true,
          totalPrice: true,
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
 * Counts total invoices matching criteria.
 */
function countInvoices(where) {
  return prisma.invoice.count({ where });
}

/**
 * Fetches a single invoice details including its line items (joined with product info) and customer.
 */
function getInvoiceById(id) {
  return prisma.invoice.findUnique({
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
      salesman: true,
    },
  });
}

module.exports = {
  createInvoice,
  getAllInvoices,
  countInvoices,
  getInvoiceById,
};
