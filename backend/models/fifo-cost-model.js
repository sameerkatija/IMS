const prisma = require("../config/prisma");

let isInventoryCostLayerSupported = null;

async function checkInventoryCostLayerSupport() {
  if (isInventoryCostLayerSupported !== null) {
    return isInventoryCostLayerSupported;
  }
  try {
    const res = await prisma.$queryRaw`
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'InventoryCostLayer'
      LIMIT 1;
    `;
    isInventoryCostLayerSupported = Array.isArray(res) && res.length > 0;
  } catch (e) {
    isInventoryCostLayerSupported = false;
  }
  return isInventoryCostLayerSupported;
}

/**
 * Creates a new FIFO Inventory Cost Layer.
 * Called on every confirmed purchase ingest or initial stock setup.
 */
async function createCostLayer(
  { productId, purchaseId = null, purchaseItemId = null, quantity, unitCost, receivedDate = new Date() },
  txClient
) {
  const tx = txClient || prisma;

  if (quantity <= 0) {
    throw new Error("Cost layer quantity must be positive.");
  }

  const hasTable = await checkInventoryCostLayerSupport();
  if (!hasTable) return null;

  try {
    const layer = await tx.inventoryCostLayer.create({
      data: {
        productId,
        purchaseId,
        purchaseItemId,
        initialQuantity: quantity,
        remainingQuantity: quantity,
        unitCost: Number(unitCost),
        receivedDate,
      },
    });

    return layer;
  } catch (err) {
    return null;
  }
}

/**
 * Consumes stock from active FIFO layers in chronological order (First-In, First-Out).
 * Returns exact total COGS and effective unit cost at sale for this batch.
 */
async function consumeFIFOCost({ productId, quantity }, txClient) {
  const tx = txClient || prisma;

  if (quantity <= 0) {
    return { totalCOGS: 0, effectiveUnitCostAtSale: 0, layersConsumed: [] };
  }

  const hasTable = await checkInventoryCostLayerSupport();
  if (!hasTable) {
    // Directly calculate from product.costPrice without touching inventoryCostLayer
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { costPrice: true },
    });
    const fallbackUnitCost = product ? Number(product.costPrice || 0) : 0;
    const totalCOGS = quantity * fallbackUnitCost;
    return {
      totalCOGS: Math.round(totalCOGS * 100) / 100,
      effectiveUnitCostAtSale: fallbackUnitCost,
      layersConsumed: [
        {
          fallback: true,
          quantity,
          unitCost: fallbackUnitCost,
          lineCost: totalCOGS,
        },
      ],
    };
  }

  let availableLayers = [];
  try {
    // 1. Fetch available layers ordered by receivedDate ASC, id ASC
    availableLayers = await tx.inventoryCostLayer.findMany({
      where: {
        productId,
        remainingQuantity: { gt: 0 },
      },
      orderBy: [
        { receivedDate: "asc" },
        { id: "asc" },
      ],
    });
  } catch (err) {
    // If InventoryCostLayer table does not exist in production DB, gracefully fallback to product.costPrice
    if (err.code === "P2021" || err.message?.includes("does not exist")) {
      availableLayers = [];
    } else {
      throw err;
    }
  }

  let remainingNeeded = quantity;
  let totalCOGS = 0;
  const layersConsumed = [];

  // 2. Consume from oldest layers sequentially
  for (const layer of availableLayers) {
    if (remainingNeeded <= 0) break;

    const availableInLayer = layer.remainingQuantity;
    const take = Math.min(availableInLayer, remainingNeeded);
    const unitCost = Number(layer.unitCost);
    const costForBatch = take * unitCost;

    totalCOGS += costForBatch;
    remainingNeeded -= take;

    // Atomically decrement the layer's remainingQuantity
    await tx.inventoryCostLayer.update({
      where: { id: layer.id },
      data: {
        remainingQuantity: { decrement: take },
      },
    });

    layersConsumed.push({
      layerId: layer.id,
      quantity: take,
      unitCost,
      lineCost: costForBatch,
    });
  }

  // 3. Fallback for unlayered stock or initial legacy inventory
  if (remainingNeeded > 0) {
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { costPrice: true, name: true },
    });

    const fallbackUnitCost = product ? Number(product.costPrice || 0) : 0;
    const fallbackCost = remainingNeeded * fallbackUnitCost;
    totalCOGS += fallbackCost;

    layersConsumed.push({
      fallback: true,
      quantity: remainingNeeded,
      unitCost: fallbackUnitCost,
      lineCost: fallbackCost,
    });
  }

  const effectiveUnitCostAtSale = quantity > 0 ? totalCOGS / quantity : 0;

  return {
    totalCOGS: Math.round(totalCOGS * 100) / 100,
    effectiveUnitCostAtSale: Math.round(effectiveUnitCostAtSale * 10000) / 10000,
    layersConsumed,
  };
}

/**
 * Restores returned or unposted stock into a FIFO cost layer.
 * Used for Sales Returns so returned stock is valued at its exact historical cost.
 */
async function restoreFIFOCost(
  { productId, quantity, unitCost, receivedDate = new Date() },
  txClient
) {
  const tx = txClient || prisma;
  if (quantity <= 0) return null;

  const hasTable = await checkInventoryCostLayerSupport();
  if (!hasTable) return null;

  try {
    return await tx.inventoryCostLayer.create({
      data: {
        productId,
        initialQuantity: quantity,
        remainingQuantity: quantity,
        unitCost: Number(unitCost),
        receivedDate,
      },
    });
  } catch (err) {
    return null;
  }
}

/**
 * Computes exact FIFO valuation of remaining stock on hand.
 */
async function getInventoryValuation(productId = null, txClient) {
  const tx = txClient || prisma;
  const hasTable = await checkInventoryCostLayerSupport();

  if (!hasTable) {
    const prods = await tx.product.findMany({
      where: productId ? { id: productId } : {},
      select: { stockQuantity: true, costPrice: true },
    });
    const totalValuation = prods.reduce((sum, p) => sum + (p.stockQuantity * Number(p.costPrice || 0)), 0);
    return {
      totalValuation: Math.round(totalValuation * 100) / 100,
      layers: [],
    };
  }

  const where = { remainingQuantity: { gt: 0 } };
  if (productId) where.productId = productId;

  const layers = await tx.inventoryCostLayer.findMany({
    where,
    include: { product: { select: { name: true, sku: true, size: true } } },
    orderBy: [{ productId: "asc" }, { receivedDate: "asc" }],
  });

  const totalValuation = layers.reduce((sum, layer) => {
    return sum + (layer.remainingQuantity * Number(layer.unitCost));
  }, 0);

  return {
    totalValuation: Math.round(totalValuation * 100) / 100,
    layers,
  };
}

module.exports = {
  createCostLayer,
  consumeFIFOCost,
  restoreFIFOCost,
  getInventoryValuation,
};
