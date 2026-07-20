const prisma = require("../config/prisma");
const stockModel = require("./stock-model");
const ledgerModel = require("./ledger-model");
const { generateDocNumber } = require("../config/doc-number");

/**
 * Records a supplier stock purchase atomically in a database transaction.
 * Automatically updates product stock levels and credits the supplier's ledger.
 */
async function createPurchase({ supplierId, purchaseDate, discount = 0, paidAmount = 0, creditApplied = 0, description, items, createdById }) {
  return prisma.$transaction(async (tx) => {
    // 1. Verify supplier exists and lock the row
    const suppliers = await tx.$queryRaw`
      SELECT * FROM "Supplier" 
      WHERE id = ${supplierId} 
      FOR UPDATE
    `;
    const supplier = suppliers[0];
    if (!supplier) {
      const error = new Error("Supplier not found.");
      error.statusCode = 404;
      throw error;
    }
    if (!supplier.isActive) {
      const error = new Error("Supplier is inactive.");
      error.statusCode = 400;
      throw error;
    }


    // 2. Validate all products and calculate subtotal and item discounts
    let subtotal = 0;
    let totalItemDiscounts = 0;
    for (const item of items) {
      subtotal += (item.quantity * item.unitCost);
      totalItemDiscounts += Number(item.discount || 0);
    }

    // 3. Compute final total
    const finalDiscount = discount + totalItemDiscounts;
    const total = subtotal - finalDiscount;
    if (total < 0) {
      const error = new Error("Total purchase amount cannot be negative.");
      error.statusCode = 400;
      throw error;
    }

    if (paidAmount < 0) {
      const error = new Error("Paid amount cannot be negative.");
      error.statusCode = 400;
      throw error;
    }

    if (creditApplied < 0) {
      const error = new Error("Credit applied cannot be negative.");
      error.statusCode = 400;
      throw error;
    }

    if (paidAmount + creditApplied > total) {
      const error = new Error("Sum of paid amount and credit applied cannot exceed the purchase total.");
      error.statusCode = 400;
      throw error;
    }

    // Validate that supplier has enough credit to apply (credit exists when balance is negative)
    if (creditApplied > 0) {
      const availableCredit = supplier.balance < 0 ? Math.abs(Number(supplier.balance)) : 0;
      if (creditApplied > availableCredit) {
        const error = new Error(`Applied credit (${creditApplied}) cannot exceed supplier's available credit (${availableCredit}).`);
        error.statusCode = 400;
        throw error;
      }
    }

    const validatedItems = [];
    for (const item of items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
      });
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


      const itemDiscount = Number(item.discount || 0);
      const itemSubtotal = item.quantity * item.unitCost;

      let proportionalDiscountShare = 0;
      if (subtotal > 0 && discount > 0) {
        proportionalDiscountShare = (itemSubtotal / subtotal) * discount;
      }

      const itemTotalCost = Math.round((itemSubtotal - itemDiscount - proportionalDiscountShare) * 100) / 100;
      const netUnitCost = Math.round((itemTotalCost / item.quantity) * 100) / 100;

      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitCost: item.unitCost,
        totalCost: itemTotalCost,
        netUnitCost,
      });
    }

    const balanceDue = total - paidAmount - creditApplied;
    const status = (paidAmount + creditApplied) >= total ? "PAID" : ((paidAmount + creditApplied) > 0 ? "PARTIALLY_PAID" : "UNPAID");

    // 4. Generate purchase document code
    const purchaseNo = await generateDocNumber(tx, "purchase", "PUR");

    // 5. Create Purchase record
    const purchase = await tx.purchase.create({
      data: {
        purchaseNo,
        supplierId,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        subtotal,
        discount: finalDiscount,
        total,
        paidAmount,
        creditApplied,
        balanceDue,
        status,
        description, // maps to description in schema.prisma
        createdById,
      },
    });

    // 6. Create PurchaseItems, compute WAC, and run stock engine IN movements
    for (const item of validatedItems) {
      await tx.purchaseItem.create({
        data: {
          purchaseId: purchase.id,
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
        },
      });

      // Compute new Weighted Average Cost BEFORE adjustStock increments stockQuantity.
      // WAC formula: (existingQty * currentWAC + purchasedQty * netUnitCost) / (existingQty + purchasedQty)
      // NOTE: costPrice is intentionally NOT touched — it is a user-managed reference field.
      // Lock the product row to prevent concurrency errors
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
          ? (existingQty * existingWAC + item.quantity * item.netUnitCost) / totalQty
          : item.netUnitCost;

      await tx.product.update({
        where: { id: item.productId },
        data: { weightedAvgCost: Math.round(newWAC * 10000) / 10000 },
      });

      // Adjust stock (incrementing)
      await stockModel.adjustStock(
        {
          productId: item.productId,
          quantity: item.quantity,
          type: "IN",
          referenceType: "PURCHASE",
          referenceId: purchase.id,
          description: `Purchase ${purchaseNo}`,
          createdById,
        },
        tx
      );
    }

    // 7. If paidAmount > 0, log supplier payment
    let upfrontPayment = null;
    if (paidAmount > 0) {
      upfrontPayment = await tx.supplierPayment.create({
        data: {
          supplierId,
          purchaseId: purchase.id,
          amount: paidAmount,
          paymentDate: purchase.purchaseDate,
          description: `Cash paid for Purchase ${purchaseNo}`,
          createdById,
        },
      });
    }

    // 8. Record supplier credit ledger entry if total > 0 (increases what we owe them)
    if (total > 0) {
      await ledgerModel.recordSupplierLedgerEntry(
        {
          supplierId,
          credit: total,
          debit: 0,
          referenceType: "PURCHASE",
          referenceId: purchase.id,
          description: `Purchase ${purchaseNo}`,
        },
        tx
      );
    }

    // 9. Record supplier debit ledger entry if paidAmount > 0 (decreases what we owe them)
    if (paidAmount > 0) {
      await ledgerModel.recordSupplierLedgerEntry(
        {
          supplierId,
          credit: 0,
          debit: paidAmount,
          referenceType: "PAYMENT",
          referenceId: upfrontPayment ? upfrontPayment.id : purchase.id,
          description: `Payment for Purchase ${purchaseNo}`,
        },
        tx
      );
    }


    return purchase;
  });
}

/**
 * Returns all purchases matching search criteria, ordered by creation date desc.
 */
function getAllPurchases({ where, skip, take }) {
  return prisma.purchase.findMany({
    where,
    skip,
    take,
    include: {
      supplier: true,
      items: true,
      _count: {
        select: {
          items: true,
        },
      },
      returns: {
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
 * Counts total purchases matching criteria.
 */
function countPurchases(where) {
  return prisma.purchase.count({ where });
}

/**
 * Fetches a single purchase including its line items and supplier details.
 */
function getPurchaseById(id) {
  return prisma.purchase.findUnique({
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
      supplier: true,
      createdBy: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      returns: {
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
  createPurchase,
  getAllPurchases,
  countPurchases,
  getPurchaseById,
};
