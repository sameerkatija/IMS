const prisma = require("../config/prisma");
const stockModel = require("./stock-model");
const ledgerModel = require("./ledger-model");
const glModel = require("./gl-model");
const fifoCostModel = require("./fifo-cost-model");
const systemModel = require("./system-model");
const { generateDocNumber } = require("../config/doc-number");

/**
 * Validates invoice header constraints (customer, credit limits, salesman, item uniqueness, costs).
 */
async function validateInvoiceData(tx, { customerId, salesmanId, saleType, discount = 0, transportDiscount = 0, paidAmount = 0, creditApplied = 0, documentStatus = "POSTED", items }) {
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

  // 3. Validate items
  const seenProductIds = new Set();
  for (const item of items) {
    if (seenProductIds.has(item.productId)) {
      const error = new Error(`Duplicate product ID ${item.productId} in items. Each product can only appear once per invoice.`);
      error.statusCode = 400;
      throw error;
    }
    seenProductIds.add(item.productId);
  }

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
    subtotal += item.quantity * unitPrice;
    totalItemDiscounts += Number(item.discount || 0);
    totalCost += item.quantity * Number(product.weightedAvgCost);
  }

  // 4. Calculate invoice totals
  const finalDiscount = discount + totalItemDiscounts;
  const total = subtotal - finalDiscount;
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

  if (transportDiscount > total) {
    const error = new Error(`Transport discount (Rs. ${transportDiscount.toFixed(2)}) cannot exceed the invoice total (Rs. ${total.toFixed(2)}).`);
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
  let allocatedDiscountSum = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const product = productsMap[item.productId];
    const unitPrice = item.unitPrice !== undefined && item.unitPrice !== null ? item.unitPrice : Number(product.sellingPrice);
    const itemDiscount = Number(item.discount || 0);
    const itemSubtotal = item.quantity * unitPrice;

    let proportionalHeaderDiscountShare = 0;
    if (subtotal > 0 && discount > 0) {
      if (i === items.length - 1) {
        proportionalHeaderDiscountShare = Math.round((discount - allocatedDiscountSum) * 100) / 100;
      } else {
        proportionalHeaderDiscountShare = Math.round(((itemSubtotal / subtotal) * discount) * 100) / 100;
        allocatedDiscountSum += proportionalHeaderDiscountShare;
      }
    }

    const itemTotalPrice = Math.round((itemSubtotal - itemDiscount - proportionalHeaderDiscountShare) * 100) / 100;

    validatedItems.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice,
      costPriceAtSale: Number(product.weightedAvgCost),
      totalPrice: itemTotalPrice,
      product,
    });
  }

  const balanceDue = Math.max(0, total - transportDiscount - paidAmount - creditApplied);

  if (documentStatus === "POSTED") {
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
      const error = new Error("Cash sales must be paid in full upon confirmation.");
      error.statusCode = 400;
      throw error;
    }
  }

  const status = (paidAmount + creditApplied + transportDiscount) >= total ? "PAID" : ((paidAmount + creditApplied + transportDiscount) > 0 ? "PARTIALLY_PAID" : "UNPAID");

  return {
    subtotal,
    finalDiscount,
    total,
    transportDiscount,
    netPayable,
    balanceDue,
    status,
    validatedItems,
  };
}

/**
 * Posts stock deductions, customer payments, ledger entries, and GL journal entries atomically for a confirmed invoice.
 */
async function postInvoiceFinancialsAndStock(tx, invoice, validatedItems, { customerId, saleType, total, netPayable, transportDiscount, paidAmount, creditApplied, createdById }) {
  const invoiceNo = invoice.invoiceNo;

  // 1. Deduct stock for all items and consume from FIFO cost layers
  let totalFIFOCogs = 0;
  for (const item of validatedItems) {
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

    // Consume from FIFO cost layers
    const fifoResult = await fifoCostModel.consumeFIFOCost(
      {
        productId: item.productId,
        quantity: item.quantity,
      },
      tx
    );

    // Update InvoiceItem with exact FIFO unit cost at sale
    await tx.invoiceItem.updateMany({
      where: {
        invoiceId: invoice.id,
        productId: item.productId,
      },
      data: {
        costPriceAtSale: fifoResult.effectiveUnitCostAtSale,
      },
    });

    totalFIFOCogs += fifoResult.totalCOGS;
  }

  // 2. Upfront payment recording
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
            },
          ],
        },
      },
    });
  }

  // 3. Customer Ledger Entries
  if (customerId) {
    if (saleType === "CREDIT") {
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
    } else if (saleType === "CASH" && creditApplied > 0) {
      await ledgerModel.recordCustomerLedgerEntry(
        {
          customerId,
          debit: creditApplied,
          credit: 0,
          referenceType: "INVOICE",
          referenceId: invoice.id,
          description: `Store credit applied to Cash Invoice ${invoiceNo}`,
        },
        tx
      );
    }
  }

  // 4. Transport expense record
  if (transportDiscount > 0) {
    const expenseCategoryName = "Transport";
    const expCategory = await tx.expenseCategory.upsert({
      where: { name: expenseCategoryName },
      update: {},
      create: { name: expenseCategoryName },
    });

    await tx.expense.create({
      data: {
        categoryId: expCategory.id,
        amount: transportDiscount,
        expenseDate: invoice.invoiceDate,
        description: `Transport expense for Invoice ${invoiceNo}`,
        createdById,
      },
    });
  }

  // 5. Post GL Journal Entries
  const totalCOGS = Math.round(totalFIFOCogs * 100) / 100;
  const glEntries = [];

  if (saleType === "CREDIT") {
    const arAmount = Math.round((netPayable - paidAmount - creditApplied) * 100) / 100;
    if (arAmount > 0) {
      glEntries.push({ code: "1100", debit: arAmount, credit: 0, description: `AR for Invoice ${invoiceNo}` });
    }
    if (paidAmount > 0) {
      glEntries.push({ code: "1000", debit: paidAmount, credit: 0, description: `Cash received upfront for Invoice ${invoiceNo}` });
    }
    if (creditApplied > 0) {
      glEntries.push({ code: "2100", debit: creditApplied, credit: 0, description: `Store credit applied to Invoice ${invoiceNo}` });
    }
  } else {
    const cashReceived = Math.round((netPayable - creditApplied) * 100) / 100;
    if (cashReceived > 0) {
      glEntries.push({ code: "1000", debit: cashReceived, credit: 0, description: `Cash for Invoice ${invoiceNo}` });
    }
    if (creditApplied > 0) {
      glEntries.push({ code: "2100", debit: creditApplied, credit: 0, description: `Store credit applied to Invoice ${invoiceNo}` });
    }
  }
  glEntries.push({ code: "4000", debit: 0, credit: total, description: `Sales Revenue for Invoice ${invoiceNo}` });

  if (transportDiscount > 0) {
    glEntries.push({ code: "6000", debit: transportDiscount, credit: 0, description: `Transport discount expense for Invoice ${invoiceNo}` });
  }

  if (totalCOGS > 0) {
    glEntries.push({ code: "5000", debit: totalCOGS, credit: 0, description: `COGS for Invoice ${invoiceNo}` });
    glEntries.push({ code: "1300", debit: 0, credit: totalCOGS, description: `Inventory asset reduction for Invoice ${invoiceNo}` });
  }

  await glModel.postGLJournalEntries(
    glEntries,
    { referenceType: "INVOICE", referenceId: invoice.id, createdById, entryDate: invoice.invoiceDate },
    tx
  );
}

// Helper: pack user description and item discount metadata without altering DB schema
function packDescription(userDescription, items) {
  const itemDiscounts = (items || [])
    .filter((it) => it.discountType)
    .map((it) => ({
      productId: Number(it.productId),
      discountType: it.discountType,
      discountValue: it.discountValue !== undefined ? Number(it.discountValue) : undefined,
    }));

  if (itemDiscounts.length === 0) {
    return userDescription || null;
  }

  return JSON.stringify({
    note: userDescription || "",
    itemDiscounts,
  });
}

// Helper: unpack item discount metadata from invoice description
function unpackInvoiceData(invoice) {
  if (!invoice) return invoice;
  let note = invoice.description;
  const itemDiscountsMap = {};

  if (invoice.description) {
    try {
      const parsed = JSON.parse(invoice.description);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.itemDiscounts)) {
        note = parsed.note || null;
        parsed.itemDiscounts.forEach((d) => {
          itemDiscountsMap[d.productId] = d;
        });
      }
    } catch {}
  }

  const items = (invoice.items || []).map((item) => {
    const meta = itemDiscountsMap[item.productId];
    return {
      ...item,
      discountType: meta ? meta.discountType : undefined,
      discountValue: meta ? meta.discountValue : undefined,
    };
  });

  return {
    ...invoice,
    description: note,
    items,
  };
}

/**
 * Creates a sales invoice transaction atomically.
 * Supports documentStatus: "DRAFT" or "POSTED".
 */
async function createInvoice({
  customerId,
  salesmanId,
  saleType = "CASH",
  invoiceDate,
  discount = 0,
  transportDiscount = 0,
  paidAmount = 0,
  creditApplied = 0,
  documentStatus = "POSTED",
  description,
  items,
  createdById,
}) {
  return prisma.$transaction(async (tx) => {
    const postingDate = invoiceDate ? new Date(invoiceDate) : new Date();
    await systemModel.verifyPeriodNotClosed(postingDate, tx);

    const {
      subtotal,
      finalDiscount,
      total,
      netPayable,
      balanceDue,
      status,
      validatedItems,
    } = await validateInvoiceData(tx, {
      customerId,
      salesmanId,
      saleType,
      discount,
      transportDiscount,
      paidAmount,
      creditApplied,
      documentStatus,
      items,
    });

    // Check stock if posting immediately
    if (documentStatus === "POSTED") {
      for (const item of validatedItems) {
        if (item.product.stockQuantity < item.quantity) {
          const error = new Error(`Cannot post invoice: Insufficient stock for ${item.product.name}. Available: ${item.product.stockQuantity} pcs, Requested: ${item.quantity} pcs.`);
          error.statusCode = 400;
          throw error;
        }
      }
    }

    // Generate unique sequential invoice number
    const invoiceNo = await generateDocNumber(tx, "invoice", "INV");

    // Create the Invoice record
    const invoice = await tx.invoice.create({
      data: {
        invoiceNo,
        customerId,
        salesmanId,
        saleType,
        invoiceDate: postingDate,
        subtotal,
        discount: finalDiscount,
        transportDiscount,
        total,
        paidAmount,
        creditApplied,
        balanceDue,
        status,
        documentStatus,
        description: packDescription(description, items),
        createdById,
      },
    });

    // Save line items
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
    }

    // If POSTED immediately, execute financial and stock movements
    if (documentStatus === "POSTED") {
      await postInvoiceFinancialsAndStock(tx, invoice, validatedItems, {
        customerId,
        saleType,
        total,
        netPayable,
        transportDiscount,
        paidAmount,
        creditApplied,
        createdById,
      });
    }

    return unpackInvoiceData(invoice);
  });
}

/**
 * Updates an unconfirmed DRAFT invoice.
 * If documentStatus is set to POSTED, confirms and posts the invoice.
 */
async function updateInvoice(id, {
  customerId,
  salesmanId,
  saleType = "CASH",
  invoiceDate,
  discount = 0,
  transportDiscount = 0,
  paidAmount = 0,
  creditApplied = 0,
  documentStatus = "DRAFT",
  description,
  items,
}, createdById) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findUnique({
      where: { id: Number(id) },
      include: { items: true },
    });

    if (!existing) {
      const error = new Error("Invoice not found.");
      error.statusCode = 404;
      throw error;
    }

    // Strictly enforce immutability on confirmed invoices
    if (existing.documentStatus === "POSTED") {
      const error = new Error("Invoice is confirmed and immutable. Confirmed invoices cannot be edited.");
      error.statusCode = 400;
      throw error;
    }

    const postingDate = invoiceDate ? new Date(invoiceDate) : existing.invoiceDate;
    await systemModel.verifyPeriodNotClosed(postingDate, tx);

    const {
      subtotal,
      finalDiscount,
      total,
      netPayable,
      balanceDue,
      status,
      validatedItems,
    } = await validateInvoiceData(tx, {
      customerId: customerId !== undefined ? customerId : existing.customerId,
      salesmanId: salesmanId !== undefined ? salesmanId : existing.salesmanId,
      saleType: saleType || existing.saleType,
      discount,
      transportDiscount,
      paidAmount,
      creditApplied,
      documentStatus,
      items,
    });

    if (documentStatus === "POSTED") {
      for (const item of validatedItems) {
        if (item.product.stockQuantity < item.quantity) {
          const error = new Error(`Cannot post invoice: Insufficient stock for ${item.product.name}. Available: ${item.product.stockQuantity} pcs, Requested: ${item.quantity} pcs.`);
          error.statusCode = 400;
          throw error;
        }
      }
    }

    // Delete existing line items
    await tx.invoiceItem.deleteMany({
      where: { invoiceId: Number(id) },
    });

    // Update Invoice header
    const updatedInvoice = await tx.invoice.update({
      where: { id: Number(id) },
      data: {
        customerId: customerId !== undefined ? customerId : existing.customerId,
        salesmanId: salesmanId !== undefined ? salesmanId : existing.salesmanId,
        saleType: saleType || existing.saleType,
        invoiceDate: postingDate,
        subtotal,
        discount: finalDiscount,
        transportDiscount,
        total,
        paidAmount,
        creditApplied,
        balanceDue,
        status,
        documentStatus: documentStatus || "DRAFT",
        description: description !== undefined
          ? packDescription(description, items)
          : (items ? packDescription(existing.description, items) : existing.description),
      },
    });

    // Recreate line items
    for (const item of validatedItems) {
      await tx.invoiceItem.create({
        data: {
          invoiceId: updatedInvoice.id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          costPriceAtSale: item.costPriceAtSale,
          totalPrice: item.totalPrice,
        },
      });
    }

    // If confirmed now, post financials and stock
    if (documentStatus === "POSTED") {
      await postInvoiceFinancialsAndStock(tx, updatedInvoice, validatedItems, {
        customerId: updatedInvoice.customerId,
        saleType: updatedInvoice.saleType,
        total,
        netPayable,
        transportDiscount,
        paidAmount,
        creditApplied,
        createdById: createdById || updatedInvoice.createdById,
      });
    }

    return unpackInvoiceData(updatedInvoice);
  });
}

/**
 * Confirms a DRAFT invoice and makes it immutable.
 */
async function confirmInvoice(id, createdById) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findUnique({
      where: { id: Number(id) },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!existing) {
      const error = new Error("Invoice not found.");
      error.statusCode = 404;
      throw error;
    }

    if (existing.documentStatus === "POSTED") {
      const error = new Error("Invoice is already confirmed.");
      error.statusCode = 400;
      throw error;
    }

    await systemModel.verifyPeriodNotClosed(existing.invoiceDate, tx);

    // Verify stock availability
    for (const item of existing.items) {
      if (item.product.stockQuantity < item.quantity) {
        const error = new Error(`Cannot confirm invoice: Insufficient stock for ${item.product.name}. Available: ${item.product.stockQuantity} pcs, Requested: ${item.quantity} pcs.`);
        error.statusCode = 400;
        throw error;
      }
    }

    const validatedItems = existing.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice),
      costPriceAtSale: Number(item.product.weightedAvgCost),
      totalPrice: Number(item.totalPrice),
      product: item.product,
    }));

    const total = Number(existing.total);
    const transportDiscount = Number(existing.transportDiscount || 0);
    const netPayable = total - transportDiscount;
    const paidAmount = Number(existing.paidAmount || 0);
    const creditApplied = Number(existing.creditApplied || 0);

    // Update documentStatus to POSTED
    const confirmedInvoice = await tx.invoice.update({
      where: { id: Number(id) },
      data: {
        documentStatus: "POSTED",
      },
    });

    // Post financials and stock
    await postInvoiceFinancialsAndStock(tx, confirmedInvoice, validatedItems, {
      customerId: existing.customerId,
      saleType: existing.saleType,
      total,
      netPayable,
      transportDiscount,
      paidAmount,
      creditApplied,
      createdById: createdById || existing.createdById,
    });

    return confirmedInvoice;
  });
}

/**
 * Deletes an unconfirmed DRAFT invoice.
 */
async function deleteDraftInvoice(id) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.invoice.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      const error = new Error("Invoice not found.");
      error.statusCode = 404;
      throw error;
    }

    if (existing.documentStatus === "POSTED") {
      const error = new Error("Confirmed invoices cannot be deleted.");
      error.statusCode = 400;
      throw error;
    }

    await tx.invoiceItem.deleteMany({
      where: { invoiceId: Number(id) },
    });

    await tx.invoice.delete({
      where: { id: Number(id) },
    });

    return { id: Number(id), invoiceNo: existing.invoiceNo };
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
              stockQuantity: true,
              sellingPrice: true,
              costPrice: true,
              category: {
                select: {
                  id: true,
                  name: true,
                },
              },
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
                  size: true,
                },
              },
            },
          },
        },
      },
    },
  });
  return unpackInvoiceData(invoice);
}

module.exports = {
  createInvoice,
  updateInvoice,
  confirmInvoice,
  deleteDraftInvoice,
  getAllInvoices,
  countInvoices,
  getInvoiceById,
};
