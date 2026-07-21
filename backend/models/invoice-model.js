const prisma = require("../config/prisma");
const stockModel = require("./stock-model");
const ledgerModel = require("./ledger-model");
const { generateDocNumber } = require("../config/doc-number");

/**
 * Creates a sales invoice transaction atomically.
 * Automatically decrements inventory levels, records salesman targets, log customer payments,
 * and updates the customer's ledger/balance if there's any credit component.
 */
async function createInvoice({ customerId, salesmanId, saleType = "CASH", invoiceDate, discount = 0, transportDiscount = 0, paidAmount = 0, creditApplied = 0, description, items, createdById }) {
  return prisma.$transaction(async (tx) => {
    // 1. Validate customer exists (if customerId is provided) and check credit limits
    if (customerId) {
      const customers = await tx.$queryRaw`
        SELECT * FROM "Customer" 
        WHERE id = ${customerId} 
        FOR UPDATE
      `;
      const customer = customers[0];
      if (!customer) {
        const error = new Error("Customer not found.");
        error.statusCode = 404;
        throw error;
      }
      if (!customer.isActive) {
        const error = new Error("Customer is inactive.");
        error.statusCode = 400;
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

    // 3. Loop and validate items, calculate subtotal and item discounts first
    let subtotal = 0;
    let totalCost = 0;
    let totalItemDiscounts = 0;
    const productsMap = {};

    for (const item of items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) {
        const error = new Error(`Product with ID ${item.productId} not found.`);
        error.statusCode = 404;
        throw error;
      }
      if (!product.isActive) {
        const error = new Error(`Product with ID ${item.productId} is inactive.`);
        error.statusCode = 400;
        throw error;
      }
      productsMap[item.productId] = product;


      const unitPrice = item.unitPrice !== undefined && item.unitPrice !== null ? item.unitPrice : Number(product.sellingPrice);
      subtotal += (item.quantity * unitPrice);
      totalItemDiscounts += Number(item.discount || 0);
      // Use weightedAvgCost (actual blended cost paid) — NOT costPrice (user reference)
      totalCost += item.quantity * Number(product.weightedAvgCost);
    }

    // 4. Calculate invoice totals and outstanding balance due
    const finalDiscount = discount + totalItemDiscounts;
    const total = subtotal - finalDiscount; // Running total (before transport discount)
    if (total < totalCost) {
      const error = new Error(`Invoice discount is too high. Invoice total after standard discount (Rs. ${total.toFixed(2)}) cannot go below the total cost price of the items (Rs. ${totalCost.toFixed(2)}).`);
      error.statusCode = 400;
      throw error;
    }

    if (transportDiscount < 0) {
      const error = new Error("Transport discount cannot be negative.");
      error.statusCode = 400;
      throw error;
    }

    const netPayable = total - transportDiscount;

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

    if (paidAmount + creditApplied > netPayable) {
      const error = new Error("Sum of paid amount and credit applied cannot exceed net payable amount.");
      error.statusCode = 400;
      throw error;
    }

    const validatedItems = [];
    for (const item of items) {
      const product = productsMap[item.productId];
      const unitPrice = item.unitPrice !== undefined && item.unitPrice !== null ? item.unitPrice : Number(product.sellingPrice);
      const itemDiscount = Number(item.discount || 0);
      const itemSubtotal = item.quantity * unitPrice;

      let proportionalDiscountShare = 0;
      if (subtotal > 0 && discount > 0) {
        proportionalDiscountShare = (itemSubtotal / subtotal) * discount;
      }

      const itemTotalPrice = Math.round((itemSubtotal - itemDiscount - proportionalDiscountShare) * 100) / 100;

      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        // Snapshot the WAC at time of sale — this is the historical COGS for this line item.
        // weightedAvgCost reflects the actual blended discounted cost in inventory, not the user reference price.
        costPriceAtSale: Number(product.weightedAvgCost),
        totalPrice: itemTotalPrice,
      });
    }

    const balanceDue = total - transportDiscount - paidAmount - creditApplied;

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
    if (saleType === "CASH" && balanceDue > 0) {
      const error = new Error("Cash sales must be paid in full.");
      error.statusCode = 400;
      throw error;
    }

    // 5. Generate unique sequential invoice number
    const invoiceNo = await generateDocNumber(tx, "invoice", "INV");
    const status = (paidAmount + creditApplied + transportDiscount) >= total ? "PAID" : ((paidAmount + creditApplied + transportDiscount) > 0 ? "PARTIALLY_PAID" : "UNPAID");

    // 6. Create the Invoice record
    const invoice = await tx.invoice.create({
      data: {
        invoiceNo,
        customerId,
        salesmanId,
        saleType,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
        subtotal,
        discount: finalDiscount,
        transportDiscount,
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
    let upfrontPayment = null;
    if (paidAmount > 0 && customerId) {
      upfrontPayment = await tx.customerPayment.create({
        data: {
          customerId,
          amount: paidAmount,
          paymentDate: invoice.invoiceDate,
          description: `Cash paid upfront for Invoice ${invoiceNo}`,
          createdById,
          allocations: {
            create: [
              {
                invoiceId: invoice.id,
                amountAllocated: paidAmount,
              }
            ]
          }
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

      if (transportDiscount > 0) {
        await ledgerModel.recordCustomerLedgerEntry(
          {
            customerId,
            debit: 0,
            credit: transportDiscount,
            referenceType: "INVOICE",
            referenceId: invoice.id,
            description: `Transport discount allowance for Invoice ${invoiceNo}`,
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
            referenceType: "PAYMENT",
            referenceId: upfrontPayment ? upfrontPayment.id : invoice.id,
            description: `Cash payment upfront for Invoice ${invoiceNo}`,
          },
          tx
        );
      }

    }

    // 10. Record Transport Discount as a general expense
    if (transportDiscount > 0) {
      const expenseCategoryName = "transport discount";
      const expCategory = await tx.expenseCategory.upsert({
        where: { name: expenseCategoryName },
        update: {},
        create: { name: expenseCategoryName, isActive: true }
      });

      await tx.expense.create({
        data: {
          categoryId: expCategory.id,
          amount: transportDiscount,
          expenseDate: invoice.invoiceDate,
          description: `Transport discount for Invoice ${invoiceNo}`,
          createdById,
        }
      });
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
      salesReturns: {
        select: {
          id: true,
          returnNo: true,
          totalAmount: true,
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
      createdBy: {
        select: {
          name: true,
        },
      },
      salesReturns: {
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                }
              }
            }
          }
        }
      },
    },
  });
}


module.exports = {
  createInvoice,
  getAllInvoices,
  countInvoices,
  getInvoiceById,
};
