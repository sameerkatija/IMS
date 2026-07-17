const prisma = require("../config/prisma");

/**
 * Adjusts the stock quantity of a product inside an optional or existing transaction.
 * Enforces non-negative stock quantity atomically in the database.
 */
async function adjustStock({ productId, quantity, type, referenceType, referenceId, description, createdById }, txClient) {
  const tx = txClient || prisma;

  if (quantity <= 0) {
    throw new Error("Quantity must be positive.");
  }

  const delta = type === "OUT" ? -quantity : quantity;

  // Atomic update: only proceed if the resulting stock is >= 0
  const result = await tx.product.updateMany({
    where: {
      id: productId,
      stockQuantity: { gte: -delta },
    },
    data: {
      stockQuantity: { increment: delta },
    },
  });

  if (result.count === 0) {
    // Determine the reason for failure (product missing vs. insufficient stock)
    const product = await tx.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      const error = new Error("Product not found.");
      error.statusCode = 404;
      throw error;
    }

    const error = new Error("Insufficient stock.");
    error.statusCode = 400;
    throw error;
  }

  // Create audit log entry
  await tx.stockMovement.create({
    data: {
      productId,
      type,
      quantity,
      referenceType,
      referenceId,
      createdById,
      description,
    },
  });
}

/**
 * Creates a manual StockAdjustment log and performs the corresponding stock adjustment in a transaction.
 */
async function createAdjustment({ productId, quantity, reason, description, createdById }) {
  return prisma.$transaction(async (tx) => {
    // Fetch product to obtain costPrice
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { costPrice: true, name: true }
    });
    if (!product) {
      throw new Error("Product not found");
    }

    // Insert into StockAdjustment (database column is notes, mapped from API description)
    const adjustment = await tx.stockAdjustment.create({
      data: {
        productId,
        quantity,
        reason,
        notes: description,
        createdById,
      },
    });

    // Run stock engine adjustment
    await adjustStock({
      productId,
      quantity: Math.abs(quantity),
      type: quantity > 0 ? "IN" : "OUT",
      referenceType: "ADJUSTMENT",
      referenceId: adjustment.id,
      description,
      createdById,
    }, tx);

    // ONLY create an Expense record if it is a stock reduction from Damaged or Expired reasons
    const isLossReason = reason === "Damaged" || reason === "Expired";
    if (quantity < 0 && isLossReason) {
      const expenseCategoryName = "inventory loss/shrinkage";
      const expCategory = await tx.expenseCategory.upsert({
        where: { name: expenseCategoryName },
        update: {},
        create: { name: expenseCategoryName, isActive: true }
      });

      const unitCost = Number(product.costPrice) || 0;
      const expenseAmount = unitCost * Math.abs(quantity); // Loss is logged as a positive expense amount

      await tx.expense.create({
        data: {
          categoryId: expCategory.id,
          amount: expenseAmount,
          description: `Inventory Adjustment (Loss): ${Math.abs(quantity)} pcs of ${product.name} (Reason: ${reason})`,
          createdById,
        }
      });
    }

    return adjustment;
  });
}

/**
 * Lists stock movements based on filters, ordered by creation date descending.
 */
function listMovements({ where, skip, take }) {
  return prisma.stockMovement.findMany({
    where,
    skip,
    take,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          stockQuantity: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          username: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Counts total movements matching criteria.
 */
function countMovements(where) {
  return prisma.stockMovement.count({ where });
}

/**
 * Verifies that the denormalized stockQuantity in the Product table matches the sum of all movements.
 */
async function verifyIntegrity(productId) {
  const product = await prisma.product.findUnique({
    where: { id: Number(productId) },
  });

  if (!product) {
    const error = new Error("Product not found.");
    error.statusCode = 404;
    throw error;
  }

  // Sum all movements for this product
  const result = await prisma.$queryRaw`
    SELECT COALESCE(SUM(
      CASE 
        WHEN type = 'IN' THEN quantity
        WHEN type = 'OUT' THEN -quantity
      END
    ), 0)::int AS total
    FROM "StockMovement"
    WHERE "productId" = ${Number(productId)}
  `;

  const movementTotal = result[0]?.total ?? 0;
  const stockQuantity = product.stockQuantity;

  return {
    productId: Number(productId),
    stockQuantity,
    movementTotal,
    inSync: stockQuantity === movementTotal,
  };
}

module.exports = {
  adjustStock,
  createAdjustment,
  listMovements,
  countMovements,
  verifyIntegrity,
};
