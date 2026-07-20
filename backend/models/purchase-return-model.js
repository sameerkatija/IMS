const prisma = require("../config/prisma");
const stockModel = require("./stock-model");
const ledgerModel = require("./ledger-model");
const { generateDocNumber } = require("../config/doc-number");

/**
 * Creates a purchase return atomically in a database transaction.
 * Validates that returned quantities do not exceed original purchase quantities (minus already returned quantities).
 * Updates stock (decrementing) and writes a debit entry in the supplier ledger.
 */
async function createPurchaseReturn({ supplierId, purchaseId, returnDate, reason, items, createdById }) {
  return prisma.$transaction(async (tx) => {
    // 1. Verify supplier exists
    const supplier = await tx.supplier.findUnique({
      where: { id: supplierId },
    });
    if (!supplier) {
      const error = new Error("Supplier not found.");
      error.statusCode = 404;
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

      // Reverse the WAC for returned units BEFORE adjustStock decrements stockQuantity.
      // Formula: newWAC = (currentPool − returnedCost) / remainingQty
      // where currentPool = currentStock × currentWAC  and  returnedCost = returnedQty × returnUnitCost
      // If all units are gone, WAC resets to 0.
      // Lock product row to prevent concurrent WAC calculation race conditions
      const products = await tx.$queryRaw`
        SELECT "stockQuantity", "weightedAvgCost" FROM "Product" 
        WHERE id = ${item.productId} 
        FOR UPDATE
      `;
      const productSnap = products[0];
      const currentQty = Number(productSnap.stockQuantity);
      const currentWAC = Number(productSnap.weightedAvgCost);
      const remainingQty = currentQty - item.quantity;

      let newWAC;
      if (remainingQty <= 0) {
        newWAC = 0;
      } else {
        const poolValue = currentQty * currentWAC;
        const removedValue = item.quantity * item.unitCost; // net unit cost at time of original purchase
        const netPoolValue = poolValue - removedValue;
        if (netPoolValue <= 0) {
          newWAC = currentWAC;
        } else {
          newWAC = netPoolValue / remainingQty;
        }
      }

      await tx.product.update({
        where: { id: item.productId },
        data: { weightedAvgCost: Math.round(newWAC * 10000) / 10000 },
      });

      // Adjust stock (decrementing) — happens AFTER WAC reversal so the formula above has correct qty
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

    // 8. Update original Purchase balanceDue and status to reflect the returned amount.
    //    A return reduces the liability we have toward the supplier, so it reduces balanceDue.
    //    This mirrors exactly how Invoice.balanceDue is updated when a sales return is processed.
    const appliedToPurchase = Math.min(totalAmount, Number(purchase.balanceDue));
    const newBalanceDue = Math.max(0, Number(purchase.balanceDue) - appliedToPurchase);
    const newStatus =
      newBalanceDue <= 0
        ? "PAID"
        : newBalanceDue < Number(purchase.total)
        ? "PARTIALLY_PAID"
        : "UNPAID";

    await tx.purchase.update({
      where: { id: purchaseId },
      data: {
        balanceDue: newBalanceDue,
        status: newStatus,
        returnedAmount: { increment: appliedToPurchase }
      },
    });


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
