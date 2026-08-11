const prisma = require("../config/prisma");
const stockModel = require("./stock-model");
const ledgerModel = require("./ledger-model");
const glModel = require("./gl-model");
const systemModel = require("./system-model");
const { generateDocNumber } = require("../config/doc-number");

/**
 * Creates a purchase return atomically in a database transaction.
 * Validates that returned quantities do not exceed original purchase quantities (minus already returned quantities).
 * Updates stock (decrementing) and writes a debit entry in the supplier ledger.
 */
async function createPurchaseReturn({ supplierId, purchaseId, returnDate, reason, items, refundType, createdById }) {
  return prisma.$transaction(async (tx) => {
    // Check if accounting period for returnDate is closed
    await systemModel.verifyPeriodNotClosed(returnDate, tx);

    // 1. Verify supplier exists
    const supplier = await tx.supplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplier) {
      const error = new Error("Supplier not found.");
      error.statusCode = 404;
      throw error;
    }

    // MED-02 FIX: Validate supplier is active (mirrors the check in createPurchase)
    if (!supplier.isActive) {
      const error = new Error("Cannot process a return for an inactive supplier.");
      error.statusCode = 400;
      throw error;
    }

    // 2. Fetch original purchase and existing returns
    const purchase = await tx.purchase.findUnique({
      where: { id: purchaseId },
      include: {
        items: true,
        returns: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!purchase) {
      const error = new Error("Purchase not found.");
      error.statusCode = 404;
      throw error;
    }

    if (purchase.supplierId !== supplierId) {
      const error = new Error("Purchase supplier mismatch.");
      error.statusCode = 400;
      throw error;
    }

    // Map original purchase items
    const purchasedQtyMap = {};
    for (const pItem of purchase.items) {
      purchasedQtyMap[pItem.productId] = pItem.quantity;
    }

    // Map already returned quantities
    const alreadyReturnedQtyMap = {};
    for (const ret of purchase.returns) {
      for (const retItem of ret.items) {
        alreadyReturnedQtyMap[retItem.productId] =
          (alreadyReturnedQtyMap[retItem.productId] || 0) + retItem.quantity;
      }
    }

    // 3. Validate items to return and compute total refund amount
    let totalAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      const pItem = purchase.items.find(pi => pi.productId === item.productId);
      if (!pItem) {
        const error = new Error(`Product with ID ${item.productId} was not part of the original purchase.`);
        error.statusCode = 400;
        throw error;
      }

      const purchasedQty = pItem.quantity;
      const alreadyReturned = alreadyReturnedQtyMap[item.productId] || 0;
      const remaining = purchasedQty - alreadyReturned;

      if (item.quantity > remaining) {
        const error = new Error(
          `Return quantity for Product ID ${item.productId} (${item.quantity}) exceeds remaining returnable quantity (${remaining}). Original Purchased: ${purchasedQty}, Already Returned: ${alreadyReturned}.`
        );
        error.statusCode = 400;
        throw error;
      }

      const netUnitCost = Number(pItem.totalCost) / purchasedQty;
      const itemTotal = item.quantity * netUnitCost;
      totalAmount += itemTotal;

      validatedItems.push({
        productId: item.productId,
        quantity: item.quantity,
        unitCost: netUnitCost,
        totalCost: itemTotal,
      });
    }

    // 4. Generate PR document code
    const returnNo = await generateDocNumber(tx, "purchaseReturn", "PR");

    // 5. Create Purchase Return record
    const purchaseReturn = await tx.purchaseReturn.create({
      data: {
        returnNo,
        supplierId,
        purchaseId,
        returnDate: returnDate ? new Date(returnDate) : new Date(),
        totalAmount,
        reason,
        createdById,
      },
    });

    // 6. Create PurchaseReturnItems, reverse WAC, and run stock engine OUT movements
    for (const item of validatedItems) {
      await tx.purchaseReturnItem.create({
        data: {
          purchaseReturnId: purchaseReturn.id,
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
        },
      });

      // Phase 12 Invariant: Purchase returns NEVER re-derive WAC for remaining stock.
      // Remaining stock stays at its current pool WAC. The stock OUT movement decrements
      // stockQuantity at current pool WAC without modifying per-unit WAC of remaining stock.
      // Lock product row to prevent concurrency race conditions.
      await tx.$queryRaw`
        SELECT "stockQuantity", "weightedAvgCost" FROM "Product" 
        WHERE id = ${item.productId} 
        FOR UPDATE
      `;

      // Adjust stock OUT (decrementing physical stock quantity)
      await stockModel.adjustStock(
        {
          productId: item.productId,
          quantity: item.quantity,
          type: "OUT",
          referenceType: "PURCHASE_RETURN",
          referenceId: purchaseReturn.id,
          description: reason || `Purchase Return ${returnNo}`,
          createdById,
        },
        tx
      );
    }

    // 7. Record supplier debit ledger entry if totalAmount > 0 (reduces what we owe them)
    if (totalAmount > 0) {
      await ledgerModel.recordSupplierLedgerEntry(
        {
          supplierId,
          credit: 0,
          debit: totalAmount,
          referenceType: "PURCHASE_RETURN",
          referenceId: purchaseReturn.id,
          description: `Purchase Return ${returnNo} for Purchase ${purchase.purchaseNo}`,
        },
        tx
      );
    }

    // 8. Update original Purchase balanceDue, returnedAmount, and status to reflect the returned amount.
    const currentReturnedAmount = Number(purchase.returnedAmount || 0);
    const updatedReturnedAmount = Math.round((currentReturnedAmount + totalAmount) * 100) / 100;
    const appliedToPurchase = Math.min(totalAmount, Number(purchase.balanceDue));
    const newBalanceDue = Math.max(0, Math.round((Number(purchase.balanceDue) - appliedToPurchase) * 100) / 100);
    const totalSettled = Number(purchase.paidAmount || 0) + Number(purchase.creditApplied || 0) + updatedReturnedAmount;
    const purchaseTotal = Number(purchase.total || 0);
    const newStatus =
      totalSettled >= purchaseTotal
        ? "PAID"
        : totalSettled > 0
        ? "PARTIALLY_PAID"
        : "UNPAID";

    await tx.purchase.update({
      where: { id: purchaseId },
      data: {
        returnedAmount: updatedReturnedAmount,
        balanceDue: newBalanceDue,
        status: newStatus,
      },
    });

    // 9. Post General Ledger (GL) Journal Entries
    let inventoryValueAtPoolWAC = 0;
    for (const item of validatedItems) {
      const productSnap = await tx.product.findUnique({ where: { id: item.productId } });
      const currentWAC = Number(productSnap?.weightedAvgCost || 0);
      inventoryValueAtPoolWAC += item.quantity * currentWAC;
    }
    inventoryValueAtPoolWAC = Math.round(inventoryValueAtPoolWAC * 100) / 100;

    const variance = Math.round((totalAmount - inventoryValueAtPoolWAC) * 100) / 100;
    // LOW-07 FIX: Use the explicitly passed refundType if provided;
    // otherwise fall back to balance-based auto-detection.
    // isCashRefund = true when caller specifies "CASH", or when purchase has no remaining balance.
    const isCashRefund = (refundType === "CASH") || (!refundType && Number(purchase.balanceDue) === 0);
    const glDebitCode = isCashRefund ? "1000" : "2000";
    const glDebitDesc = isCashRefund
      ? `Cash refund received for Purchase Return ${returnNo}`
      : `AP reduction for Purchase Return ${returnNo}`;

    const glEntries = [
      { code: glDebitCode, debit: totalAmount, credit: 0, description: glDebitDesc },
      { code: "1300", debit: 0, credit: inventoryValueAtPoolWAC, description: `Inventory stock OUT at pool WAC for Purchase Return ${returnNo}` },
    ];

    if (variance > 0) {
      glEntries.push({ code: "5100", debit: 0, credit: variance, description: `Purchase Return Variance gain for ${returnNo}` });
    } else if (variance < 0) {
      glEntries.push({ code: "5100", debit: Math.abs(variance), credit: 0, description: `Purchase Return Variance loss for ${returnNo}` });
    }

    await glModel.postGLJournalEntries(
      glEntries,
      { referenceType: "PURCHASE_RETURN", referenceId: purchaseReturn.id, createdById, entryDate: purchaseReturn.returnDate },
      tx
    );

    return purchaseReturn;
  });
}

/**
 * Returns all purchase returns matching criteria, ordered by creation desc.
 */
function getAllPurchaseReturns({ where, skip, take }) {
  return prisma.purchaseReturn.findMany({
    where,
    skip,
    take,
    include: {
      supplier: {
        select: {
          name: true,
        },
      },
      purchase: {
        select: {
          purchaseNo: true,
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
 * Counts total purchase returns matching criteria.
 */
function countPurchaseReturns(where) {
  return prisma.purchaseReturn.count({ where });
}

/**
 * Fetches single purchase return by ID.
 */
function getPurchaseReturnById(id) {
  return prisma.purchaseReturn.findUnique({
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
      purchase: {
        select: {
          id: true,
          purchaseNo: true,
          purchaseDate: true,
        },
      },
    },
  });
}

module.exports = {
  createPurchaseReturn,
  getAllPurchaseReturns,
  countPurchaseReturns,
  getPurchaseReturnById,
};
