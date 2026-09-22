const prisma = require("../config/prisma");
const glModel = require("./gl-model");

/**
 * Aggregates high-level metrics for the dashboard view.
 */
async function getDashboardMetrics() {
  // Pakistan Standard Time is UTC+5. Compute today's day in PKT.
  const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
  const nowUtc = Date.now();
  // Current time in PKT
  const nowPkt = new Date(nowUtc + PKT_OFFSET_MS);
  // Midnight PKT as a UTC timestamp
  const pktMidnightMs =
    Date.UTC(nowPkt.getUTCFullYear(), nowPkt.getUTCMonth(), nowPkt.getUTCDate()) - PKT_OFFSET_MS;
  const todayStart = new Date(pktMidnightMs);
  const todayEnd = new Date(pktMidnightMs + 24 * 60 * 60 * 1000 - 1);

  const weekStart = new Date(pktMidnightMs - 7 * 24 * 60 * 60 * 1000);

  // Month start in PKT (1st of the current PKT month)
  const monthStart = new Date(
    Date.UTC(nowPkt.getUTCFullYear(), nowPkt.getUTCMonth(), 1) - PKT_OFFSET_MS
  );
  const monthEnd = new Date(
    Date.UTC(nowPkt.getUTCFullYear(), nowPkt.getUTCMonth() + 1, 1) - PKT_OFFSET_MS
  );

  // Concurrently execute aggregates
  const [
    todaySalesAgg,
    weekSalesAgg,
    monthSalesAgg,
    receivablesAgg,
    payablesAgg,
    lowStockRes,
    monthExpensesAgg,
    monthSalesItems,
    topProductsReturnsRaw,
    monthCOGSRes,
    todayReturnsAgg,
    weekReturnsAgg,
    monthReturnsAgg,
    monthCashRefundAgg,
    monthPurchaseDiscountAgg,
    monthPaymentRefundAgg,
    todayInvoiceItemsAgg,
    todayReturnItemsAgg,
    todayInvoicesCountAgg,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: {
        invoiceDate: { gte: todayStart, lte: todayEnd },
        documentStatus: { not: "VOIDED" },
      },
    }),
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: { invoiceDate: { gte: weekStart } },
    }),
    prisma.invoice.aggregate({
      _sum: { total: true, paidAmount: true },
      where: { invoiceDate: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.customer.aggregate({
      _sum: { balance: true },
      where: { balance: { gt: 0 } },
    }),
    prisma.supplier.aggregate({
      _sum: { balance: true },
      where: { balance: { gt: 0 } },
    }),
    prisma.$queryRaw`
      SELECT COUNT(*)::int as count
      FROM "Product"
      WHERE "isActive" = true AND "stockQuantity" <= "lowStockLevel"
    `,
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { expenseDate: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.invoiceItem.findMany({
      where: {
        invoice: { invoiceDate: { gte: monthStart, lt: monthEnd } },
      },
      include: {
        invoice: { select: { total: true, subtotal: true } },
      },
    }),
    prisma.salesReturnItem.groupBy({
      by: ["productId"],
      _sum: { totalPrice: true },
      where: {
        salesReturn: { returnDate: { gte: monthStart, lt: monthEnd } },
      },
    }),
    prisma.$queryRaw`
      SELECT COALESCE(SUM(ii."costPriceAtSale" * ii.quantity), 0)::numeric AS cogs
      FROM "InvoiceItem" ii
      JOIN "Invoice" i ON ii."invoiceId" = i.id
      WHERE i."invoiceDate" >= ${monthStart} AND i."invoiceDate" < ${monthEnd}
    `,
    prisma.salesReturn.aggregate({
      _sum: { totalAmount: true },
      where: { returnDate: { gte: todayStart, lte: todayEnd } },
    }),
    prisma.salesReturn.aggregate({
      _sum: { totalAmount: true },
      where: { returnDate: { gte: weekStart } },
    }),
    prisma.salesReturn.aggregate({
      _sum: { totalAmount: true },
      where: { returnDate: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.salesReturn.aggregate({
      _sum: { totalAmount: true },
      where: {
        returnDate: { gte: monthStart, lt: monthEnd },
        refundType: "CASH",
      },
    }),
    prisma.purchase.aggregate({
      _sum: { discount: true },
      where: { purchaseDate: { gte: monthStart, lt: monthEnd } },
    }),
    prisma.customerPayment.aggregate({
      _sum: { amount: true },
      where: {
        paymentDate: { gte: monthStart, lt: monthEnd },
        paymentType: "CASH_REFUND",
      },
    }),
    prisma.invoiceItem.aggregate({
      _sum: { quantity: true },
      where: {
        invoice: {
          invoiceDate: { gte: todayStart, lte: todayEnd },
          documentStatus: { not: "VOIDED" },
        },
      },
    }),
    prisma.salesReturnItem.aggregate({
      _sum: { quantity: true },
      where: {
        salesReturn: {
          returnDate: { gte: todayStart, lte: todayEnd },
        },
      },
    }),
    prisma.invoice.count({
      where: {
        invoiceDate: { gte: todayStart, lte: todayEnd },
        documentStatus: { not: "VOIDED" },
      },
    }),
  ]);

  const todaySalesReturn = Number(todayReturnsAgg._sum.totalAmount || 0);
  const weekSalesReturn = Number(weekReturnsAgg._sum.totalAmount || 0);
  const monthSalesReturn = Number(monthReturnsAgg._sum.totalAmount || 0);
  const monthCashRefund = Number(monthCashRefundAgg._sum.totalAmount || 0) + Number(monthPaymentRefundAgg._sum.amount || 0);
  const monthPurchaseDiscount = Number(monthPurchaseDiscountAgg._sum.discount || 0);

  const todaySales = Math.max(0, Number(todaySalesAgg._sum.total || 0) - todaySalesReturn);
  const weekSales = Math.max(0, Number(weekSalesAgg._sum.total || 0) - weekSalesReturn);
  const monthSales = Math.max(0, Number(monthSalesAgg._sum.total || 0) - monthSalesReturn);
  const monthCashReceived = Math.max(0, Number(monthSalesAgg._sum.paidAmount || 0) - monthCashRefund);

  const todayProductsSoldGross = Number(todayInvoiceItemsAgg._sum.quantity || 0);
  const todayProductsReturned = Number(todayReturnItemsAgg._sum.quantity || 0);
  const todayProductsSold = Math.max(0, todayProductsSoldGross - todayProductsReturned);
  const todayInvoicesCount = todayInvoicesCountAgg || 0;

  const totalReceivables = Number(receivablesAgg._sum.balance || 0);
  const totalPayables = Number(payablesAgg._sum.balance || 0);
  const lowStockCount = lowStockRes[0]?.count ?? 0;
  const monthExpenses = Number(monthExpensesAgg._sum.amount || 0);

  // Fetch immutable General Ledger P&L metrics for exact reconciliation
  const monthPL = await glModel.getGLProfitAndLoss({ from: monthStart, to: monthEnd });
  const monthGrossProfit = monthPL.grossProfit;
  const monthNetProfit = monthPL.netProfit;
  const monthCOGS = monthPL.cogs;
  const monthReturnedCOGS = 0;

  // Resolve top products details with sales returns deducted
  const netRevenueMap = {};
  for (const item of monthSalesItems) {
    const netItemPrice = Number(item.totalPrice);

    netRevenueMap[item.productId] = (netRevenueMap[item.productId] || 0) + netItemPrice;
  }
  for (const item of topProductsReturnsRaw) {
    const prodId = item.productId;
    netRevenueMap[prodId] = (netRevenueMap[prodId] || 0) - Number(item._sum.totalPrice || 0);
  }

  const sortedProductRevenues = Object.entries(netRevenueMap)
    .map(([productId, revenue]) => ({ productId: Number(productId), revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // PERF-01 FIX: Replace N+1 findUnique loop with a single batched findMany.
  // Previously each of the top 5 products triggered a separate DB query.
  const topProductIds = sortedProductRevenues.map((item) => item.productId);
  const topProductList = await prisma.product.findMany({
    where: { id: { in: topProductIds } },
    select: { id: true, name: true, sku: true, size: true },
  });
  const topProductMap = {};
  for (const p of topProductList) {
    topProductMap[p.id] = p;
  }
  const topProducts = sortedProductRevenues.map((item) => {
    const product = topProductMap[item.productId];
    return {
      productId: item.productId,
      name: product?.name || "Unknown",
      sku: product?.sku || "",
      size: product?.size || null,
      revenue: item.revenue,
    };
  });

  return {
    todaySales,
    todaySalesReturn,
    todayProductsSold,
    todayProductsSoldGross,
    todayProductsReturned,
    todayInvoicesCount,
    weekSales,
    monthSales,
    monthSalesReturn,
    monthCashReceived,
    totalReceivables,
    totalPayables,
    lowStockCount,
    topProducts,
    monthExpenses,
    monthCOGS,
    monthReturnedCOGS,
    monthGrossProfit,
    monthNetProfit,
  };
}

/**
 * Returns total invoices volume grouped by day.
 */
async function salesByDay(from, to, customerId) {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  let result;

  if (customerId) {
    result = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', "invoiceDate")::date AS date,
        COUNT(*)::int AS count,
        COALESCE(SUM(total), 0)::numeric AS total
      FROM "Invoice"
      WHERE "invoiceDate" >= ${fromDate} AND "invoiceDate" <= ${toDate}
        AND "customerId" = ${Number(customerId)}
      GROUP BY DATE_TRUNC('day', "invoiceDate")::date
      ORDER BY date ASC
    `;
  } else {
    result = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', "invoiceDate")::date AS date,
        COUNT(*)::int AS count,
        COALESCE(SUM(total), 0)::numeric AS total
      FROM "Invoice"
      WHERE "invoiceDate" >= ${fromDate} AND "invoiceDate" <= ${toDate}
      GROUP BY DATE_TRUNC('day', "invoiceDate")::date
      ORDER BY date ASC
    `;
  }

  return result.map((r) => ({
    date: r.date,
    count: r.count,
    total: Number(r.total),
  }));
}

/**
 * Returns net salesman sales total (gross minus returns) in the period.
 */
async function salesBySalesman(from, to) {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const rows = await prisma.$queryRaw`
    SELECT 
      s.id AS "salesmanId", 
      s.name AS "salesmanName",
      COALESCE(i.gross, 0)::numeric AS gross,
      COALESCE(r.returns, 0)::numeric AS returns,
      (COALESCE(i.gross, 0) - COALESCE(r.returns, 0))::numeric AS net
    FROM "Salesman" s
    LEFT JOIN (
      SELECT "salesmanId", SUM(total) AS gross
      FROM "Invoice"
      WHERE "invoiceDate" >= ${fromDate} AND "invoiceDate" <= ${toDate}
      GROUP BY "salesmanId"
    ) i ON s.id = i."salesmanId"
    LEFT JOIN (
      SELECT inv."salesmanId", SUM(ret."totalAmount") AS returns
      FROM "SalesReturn" ret
      JOIN "Invoice" inv ON ret."invoiceId" = inv.id
      WHERE ret."returnDate" >= ${fromDate} AND ret."returnDate" <= ${toDate}
      GROUP BY inv."salesmanId"
    ) r ON s.id = r."salesmanId"
    ORDER BY net DESC
  `;

  return rows.map(r => ({
    salesmanId: r.salesmanId,
    salesmanName: r.salesmanName,
    gross: Number(r.gross),
    returns: Number(r.returns),
    net: Number(r.net)
  }));
}

/**
 * Returns total purchase transactions volume grouped by day.
 */
async function purchasesByDay(from, to, supplierId) {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  let result;

  if (supplierId) {
    result = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', "purchaseDate")::date AS date,
        COUNT(*)::int AS count,
        COALESCE(SUM(total), 0)::numeric AS total
      FROM "Purchase"
      WHERE "purchaseDate" >= ${fromDate} AND "purchaseDate" <= ${toDate}
        AND "supplierId" = ${Number(supplierId)}
      GROUP BY DATE_TRUNC('day', "purchaseDate")::date
      ORDER BY date ASC
    `;
  } else {
    result = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('day', "purchaseDate")::date AS date,
        COUNT(*)::int AS count,
        COALESCE(SUM(total), 0)::numeric AS total
      FROM "Purchase"
      WHERE "purchaseDate" >= ${fromDate} AND "purchaseDate" <= ${toDate}
      GROUP BY DATE_TRUNC('day', "purchaseDate")::date
      ORDER BY date ASC
    `;
  }

  return result.map((r) => ({
    date: r.date,
    count: r.count,
    total: Number(r.total),
  }));
}

/**
 * Evaluates current inventory stock valuation at cost and at selling price.
 */
async function currentStockReport() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      sku: true,
      size: true,
      costPrice: true,          // user-visible reference price
      weightedAvgCost: true,    // system-computed actual cost — used for valuation
      sellingPrice: true,
      stockQuantity: true,
    },
  });

  let totalValueAtCost = 0;
  let totalValueAtSelling = 0;

  const list = products.map((p) => {
    const qty = p.stockQuantity;
    const wac = Number(p.weightedAvgCost);   // actual blended cost paid for inventory
    const ref = Number(p.costPrice);          // user reference price (shown separately)
    const selling = Number(p.sellingPrice);
    const valCost = qty * wac;
    const valSelling = qty * selling;

    totalValueAtCost += valCost;
    totalValueAtSelling += valSelling;

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      size: p.size,
      stockQuantity: qty,
      costPrice: ref,           // reference only — not used in any totals
      weightedAvgCost: wac,     // the actual investment cost per unit
      sellingPrice: selling,
      valueAtCost: valCost,
      valueAtSellingPrice: valSelling,
    };
  });

  return {
    products: list,
    totalValueAtCost,
    totalValueAtSellingPrice: totalValueAtSelling,
  };
}

/**
 * Returns products with stock level below or equal to their low stock levels.
 */
async function lowStockReport() {
  return prisma.$queryRaw`
    SELECT 
      id, name, sku, size, "stockQuantity", "lowStockLevel",
      ("stockQuantity" - "lowStockLevel") AS deficiency
    FROM "Product"
    WHERE "isActive" = true AND "stockQuantity" <= "lowStockLevel"
    ORDER BY deficiency ASC
  `;
}

/**
 * Evaluates receivables aging buckets (0-30, 31-60, 60+ days) for customers with outstanding balance.
 */
async function customerLedgerReport() {
  const customers = await prisma.customer.findMany({
    where: { balance: { gt: 0 } },
    include: {
      invoices: {
        where: { balanceDue: { gt: 0 } }
      }
    }
  });

  const result = [];
  const now = new Date();

  for (const customer of customers) {
    let bucket30 = 0;
    let bucket60 = 0;
    let bucketOver = 0;

    for (const inv of customer.invoices) {
      // LOW-04 FIX: Removed Math.abs — future-dated invoices should fall into the 0-30
      // day bucket (not be treated as if they were old). Math.abs caused a post-dated invoice
      // for e.g. next week to appear with a positive age, inflating older aging buckets.
      const diffTime = now - new Date(inv.invoiceDate);
      const diffDays = diffTime > 0 ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;
      const due = Number(inv.balanceDue);

      if (diffDays <= 30) {
        bucket30 += due;
      } else if (diffDays <= 60) {
        bucket60 += due;
      } else {
        bucketOver += due;
      }
    }

    result.push({
      customerId: customer.id,
      customerName: customer.name,
      outstandingBalance: Number(customer.balance),
      aging: {
        "0-30 days": bucket30,
        "31-60 days": bucket60,
        "60+ days": bucketOver,
      },
    });
  }

  return result;
}

/**
 * Lists suppliers with outstanding balances due.
 */
async function supplierLedgerReport() {
  const suppliers = await prisma.supplier.findMany({
    where: { balance: { gt: 0 } },
    select: { id: true, name: true, phone: true, balance: true },
  });

  return suppliers.map((s) => ({
    supplierId: s.id,
    supplierName: s.name,
    phone: s.phone,
    outstandingBalance: Number(s.balance),
  }));
}

/**
 * Calculates gross profit using immutable General Ledger journal entries.
 */
async function profitReport(from, to) {
  const pl = await glModel.getGLProfitAndLoss({ from, to });
  return pl.grossProfit;
}

async function expenseReport(from, to) {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  // Fetch all active categories
  const categories = await prisma.expenseCategory.findMany({
    where: { isActive: true },
  });

  // Group expenses by category in the period
  const expensesGrouped = await prisma.expense.groupBy({
    by: ["categoryId"],
    _sum: { amount: true },
    where: {
      expenseDate: { gte: fromDate, lte: toDate },
    },
  });

  // Map each category to its expense sum or 0
  const report = categories.map((cat) => {
    const matched = expensesGrouped.find((g) => g.categoryId === cat.id);
    return {
      categoryId: cat.id,
      categoryName: cat.name,
      totalAmount: matched ? Number(matched._sum.amount || 0) : 0,
    };
  });

  // Sort by amount descending
  report.sort((a, b) => b.totalAmount - a.totalAmount);
  return report;
}

/**
 * Evaluates net profit margins directly from frozen General Ledger journal entries.
 */
async function netProfitReport(from, to) {
  const pl = await glModel.getGLProfitAndLoss({ from, to });
  return {
    grossProfit: pl.grossProfit,
    totalExpenses: pl.totalExpenses,
    netProfit: pl.netProfit,
    salesRevenue: pl.salesRevenue,
    salesReturns: pl.salesReturns,
    netSales: pl.netSales,
    cogs: pl.cogs,
    purchaseReturnVariance: pl.purchaseReturnVariance,
  };
}

/**
 * Returns gross sales grouped by product for the date range.
 */
async function salesByProduct(from, to) {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  // Fetch invoice items
  const items = await prisma.invoiceItem.findMany({
    where: {
      invoice: {
        invoiceDate: { gte: fromDate, lte: toDate },
      },
    },
    include: {
      product: true,
      invoice: { select: { total: true, subtotal: true } },
    },
  });

  // Fetch returned items
  const returnedItems = await prisma.salesReturnItem.findMany({
    where: {
      salesReturn: {
        returnDate: { gte: fromDate, lte: toDate },
      },
    },
    include: {
      product: true,
    },
  });

  const productSales = {};

  for (const item of items) {
    const name = item.product
      ? `${item.product.name}${item.product.size ? ` (${item.product.size})` : ""}`
      : "Unknown Product";
    const netItemPrice = Number(item.totalPrice);

    productSales[name] = (productSales[name] || 0) + netItemPrice;
  }

  for (const item of returnedItems) {
    const name = item.product
      ? `${item.product.name}${item.product.size ? ` (${item.product.size})` : ""}`
      : "Unknown Product";
    const amount = Number(item.totalPrice) || 0;
    productSales[name] = (productSales[name] || 0) - amount;
  }

  return Object.entries(productSales)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Returns gross sales grouped by product category for the date range.
 */
async function salesByCategory(from, to) {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  // Fetch invoice items
  const items = await prisma.invoiceItem.findMany({
    where: {
      invoice: {
        invoiceDate: { gte: fromDate, lte: toDate },
      },
    },
    include: {
      product: {
        include: {
          category: true,
        },
      },
      invoice: { select: { total: true, subtotal: true } },
    },
  });

  // Fetch returned items
  const returnedItems = await prisma.salesReturnItem.findMany({
    where: {
      salesReturn: {
        returnDate: { gte: fromDate, lte: toDate },
      },
    },
    include: {
      product: {
        include: {
          category: true,
        },
      },
    },
  });

  const categorySales = {};

  for (const item of items) {
    const name = item.product?.category?.name || "Uncategorized";
    const netItemPrice = Number(item.totalPrice);

    categorySales[name] = (categorySales[name] || 0) + netItemPrice;
  }

  for (const item of returnedItems) {
    const name = item.product?.category?.name || "Uncategorized";
    const amount = Number(item.totalPrice) || 0;
    categorySales[name] = (categorySales[name] || 0) - amount;
  }

  return Object.entries(categorySales)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Computes comprehensive Sales & Products Summary for a single date or date range.
 * Defaults to today in Pakistan Standard Time (PKT, UTC+5).
 * Supports: today, yesterday, custom date, custom date range, monthly, yearly.
 */
async function getSummary(params = {}) {
  let from, to, date;
  if (typeof params === "string") {
    date = params;
  } else if (params && typeof params === "object") {
    from = params.from;
    to = params.to;
    date = params.date;
  }

  const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
  let rangeStart, rangeEnd, targetDateStr;

  const nowUtc = Date.now();
  const nowPkt = new Date(nowUtc + PKT_OFFSET_MS);
  const todayStr = `${nowPkt.getUTCFullYear()}-${String(nowPkt.getUTCMonth() + 1).padStart(2, "0")}-${String(nowPkt.getUTCDate()).padStart(2, "0")}`;

  const fromVal = from || date;
  const toVal = to || date;

  if (fromVal && toVal) {
    const [fy, fm, fd] = fromVal.split("-").map(Number);
    const [ty, tm, td] = toVal.split("-").map(Number);
    const startMs = Date.UTC(fy, fm - 1, fd) - PKT_OFFSET_MS;
    const endMs = Date.UTC(ty, tm - 1, td, 23, 59, 59, 999) - PKT_OFFSET_MS;
    rangeStart = new Date(startMs);
    rangeEnd = new Date(endMs);
    targetDateStr = fromVal === toVal ? fromVal : `${fromVal} to ${toVal}`;
  } else if (fromVal) {
    const [y, m, d] = fromVal.split("-").map(Number);
    const startMs = Date.UTC(y, m - 1, d) - PKT_OFFSET_MS;
    rangeStart = new Date(startMs);
    rangeEnd = new Date(startMs + 24 * 60 * 60 * 1000 - 1);
    targetDateStr = fromVal;
  } else {
    // Default: Today in PKT
    const pktMidnightMs =
      Date.UTC(nowPkt.getUTCFullYear(), nowPkt.getUTCMonth(), nowPkt.getUTCDate()) - PKT_OFFSET_MS;
    rangeStart = new Date(pktMidnightMs);
    rangeEnd = new Date(pktMidnightMs + 24 * 60 * 60 * 1000 - 1);
    targetDateStr = todayStr;
  }

  // Fetch confirmed/non-voided invoices for this range with all line items and product details
  const [invoices, salesReturns, customerPayments] = await Promise.all([
    prisma.invoice.findMany({
      where: {
        invoiceDate: { gte: rangeStart, lte: rangeEnd },
        documentStatus: { not: "VOIDED" },
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        salesman: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              include: {
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { invoiceDate: "desc" },
    }),
    prisma.salesReturn.findMany({
      where: {
        returnDate: { gte: rangeStart, lte: rangeEnd },
      },
      include: {
        customer: { select: { id: true, name: true } },
        items: {
          include: {
            product: {
              include: {
                category: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { returnDate: "desc" },
    }),
    prisma.customerPayment.findMany({
      where: {
        paymentDate: { gte: rangeStart, lte: rangeEnd },
      },
      select: {
        id: true,
        amount: true,
        paymentType: true,
      },
    }),
  ]);

  // Aggregate Sales totals
  let grossSales = 0;
  let cashSales = 0;
  let creditSales = 0;
  let totalDiscount = 0;
  let totalTransportDiscount = 0;
  let cashCollectedOnInvoices = 0;

  for (const inv of invoices) {
    const invTotal = Number(inv.total || 0);
    grossSales += invTotal;
    totalDiscount += Number(inv.discount || 0);
    totalTransportDiscount += Number(inv.transportDiscount || 0);
    cashCollectedOnInvoices += Number(inv.paidAmount || 0);

    if (inv.saleType === "CASH") {
      cashSales += invTotal;
    } else {
      creditSales += invTotal;
    }
  }

  // Aggregate Sales Returns totals
  let totalReturns = 0;
  let cashRefunds = 0;
  for (const ret of salesReturns) {
    const retAmount = Number(ret.totalAmount || 0);
    totalReturns += retAmount;
    if (ret.refundType === "CASH") {
      cashRefunds += retAmount;
    }
  }

  const netSales = Math.max(0, grossSales - totalReturns);

  // Customer payments received today
  let directCustomerPayments = 0;
  for (const p of customerPayments) {
    if (p.paymentType === "CASH_REFUND") {
      directCustomerPayments -= Number(p.amount || 0);
    } else {
      directCustomerPayments += Number(p.amount || 0);
    }
  }
  const totalCashInflow = Math.max(0, cashCollectedOnInvoices + directCustomerPayments);

  // Accumulative Products Sold aggregation
  const productMap = {};

  // 1. Process sold invoice items
  for (const inv of invoices) {
    for (const item of inv.items) {
      const pId = item.productId;
      if (!productMap[pId]) {
        const prod = item.product;
        productMap[pId] = {
          productId: pId,
          name: prod?.name || "Unknown Product",
          sku: prod?.sku || "",
          size: prod?.size || null,
          categoryName: prod?.category?.name || "Uncategorized",
          piecesPerCarton: prod?.piecesPerCarton || null,
          unitPrice: Number(item.unitPrice || 0),
          quantitySold: 0,
          quantityReturned: 0,
          netQuantity: 0,
          grossRevenue: 0,
          returnedRevenue: 0,
          netRevenue: 0,
        };
      }
      productMap[pId].quantitySold += Number(item.quantity || 0);
      productMap[pId].grossRevenue += Number(item.totalPrice || 0);
    }
  }

  // 2. Process return items
  for (const ret of salesReturns) {
    for (const item of ret.items) {
      const pId = item.productId;
      if (!productMap[pId]) {
        const prod = item.product;
        productMap[pId] = {
          productId: pId,
          name: prod?.name || "Unknown Product",
          sku: prod?.sku || "",
          size: prod?.size || null,
          categoryName: prod?.category?.name || "Uncategorized",
          piecesPerCarton: prod?.piecesPerCarton || null,
          unitPrice: Number(item.unitPrice || 0),
          quantitySold: 0,
          quantityReturned: 0,
          netQuantity: 0,
          grossRevenue: 0,
          returnedRevenue: 0,
          netRevenue: 0,
        };
      }
      productMap[pId].quantityReturned += Number(item.quantity || 0);
      productMap[pId].returnedRevenue += Number(item.totalPrice || 0);
    }
  }

  // 3. Finalize product statistics and carton breakdowns
  let totalGrossPieces = 0;
  let totalReturnedPieces = 0;
  let totalNetPieces = 0;

  const productList = Object.values(productMap).map((p) => {
    p.netQuantity = p.quantitySold - p.quantityReturned;
    p.netRevenue = Math.max(0, p.grossRevenue - p.returnedRevenue);
    p.averagePrice = p.quantitySold > 0 ? p.grossRevenue / p.quantitySold : p.unitPrice;

    // Cartons calculation if piecesPerCarton configured
    if (p.piecesPerCarton && p.piecesPerCarton > 0) {
      const cartons = Math.floor(p.netQuantity / p.piecesPerCarton);
      const loosePieces = p.netQuantity % p.piecesPerCarton;
      p.cartons = cartons;
      p.loosePieces = loosePieces;
      p.cartonDisplay = `${cartons} ctn${cartons !== 1 ? "s" : ""}${loosePieces > 0 ? `, ${loosePieces} pcs` : ""}`;
    } else {
      p.cartons = null;
      p.loosePieces = null;
      p.cartonDisplay = `${p.netQuantity} pcs`;
    }

    totalGrossPieces += p.quantitySold;
    totalReturnedPieces += p.quantityReturned;
    totalNetPieces += p.netQuantity;

    return p;
  });

  // Sort products by net quantity sold descending
  productList.sort((a, b) => b.netQuantity - a.netQuantity || b.netRevenue - a.netRevenue);

  // Salesmen daily breakdown
  const salesmanMap = {};
  for (const inv of invoices) {
    const sId = inv.salesmanId || "unassigned";
    const sName = inv.salesman?.name || "Unassigned / Direct";
    if (!salesmanMap[sId]) {
      salesmanMap[sId] = {
        salesmanId: inv.salesmanId,
        salesmanName: sName,
        invoiceCount: 0,
        grossSales: 0,
        returns: 0,
        netSales: 0,
      };
    }
    salesmanMap[sId].invoiceCount += 1;
    salesmanMap[sId].grossSales += Number(inv.total || 0);
  }

  // Deduct returns attributed to salesmen
  for (const ret of salesReturns) {
    const inv = ret.invoiceId ? invoices.find((i) => i.id === ret.invoiceId) : null;
    const sId = inv?.salesmanId || "unassigned";
    if (salesmanMap[sId]) {
      salesmanMap[sId].returns += Number(ret.totalAmount || 0);
    }
  }

  const salesmenList = Object.values(salesmanMap).map((s) => ({
    ...s,
    netSales: Math.max(0, s.grossSales - s.returns),
  })).sort((a, b) => b.netSales - a.netSales);

  // Invoices summary list
  const invoiceList = invoices.map((inv) => ({
    id: inv.id,
    invoiceNo: inv.invoiceNo,
    invoiceDate: inv.invoiceDate,
    customerName: inv.customer?.name || "Walk-in Cash Customer",
    salesmanName: inv.salesman?.name || "-",
    saleType: inv.saleType,
    subtotal: Number(inv.subtotal),
    discount: Number(inv.discount || 0),
    transportDiscount: Number(inv.transportDiscount || 0),
    total: Number(inv.total),
    paidAmount: Number(inv.paidAmount),
    balanceDue: Number(inv.balanceDue),
    itemCount: inv.items.length,
    totalPieces: inv.items.reduce((sum, it) => sum + it.quantity, 0),
  }));

  return {
    date: targetDateStr,
    from: rangeStart.toISOString(),
    to: rangeEnd.toISOString(),
    summary: {
      totalSell: netSales,
      grossSales,
      totalReturns,
      netSales,
      cashSales,
      creditSales,
      cashCollectedOnInvoices,
      totalCashInflow,
      totalInvoices: invoices.length,
      totalReturnsCount: salesReturns.length,
      // Accumulative Products Sold
      accumulativeProductsSold: Math.max(0, totalNetPieces),
      totalGrossPieces,
      totalReturnedPieces,
      uniqueProductsCount: productList.length,
    },
    productsSold: productList,
    salesmen: salesmenList,
    invoices: invoiceList,
  };
}

async function getDailySummary(dateString) {
  return getSummary({ date: dateString });
}

module.exports = {
  getDashboardMetrics,
  getSummary,
  getDailySummary,
  salesByDay,
  salesBySalesman,
  purchasesByDay,
  currentStockReport,
  lowStockReport,
  customerLedgerReport,
  supplierLedgerReport,
  profitReport,
  expenseReport,
  netProfitReport,
  salesByProduct,
  salesByCategory,
};

