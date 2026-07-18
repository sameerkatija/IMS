const prisma = require("../config/prisma");

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
  ] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: { invoiceDate: { gte: todayStart, lte: todayEnd } },
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
  ]);

  const todaySalesReturn = Number(todayReturnsAgg._sum.totalAmount || 0);
  const weekSalesReturn = Number(weekReturnsAgg._sum.totalAmount || 0);
  const monthSalesReturn = Number(monthReturnsAgg._sum.totalAmount || 0);
  const monthCashRefund = Number(monthCashRefundAgg._sum.totalAmount || 0);

  const todaySales = Math.max(0, Number(todaySalesAgg._sum.total || 0) - todaySalesReturn);
  const weekSales = Math.max(0, Number(weekSalesAgg._sum.total || 0) - weekSalesReturn);
  const monthSales = Math.max(0, Number(monthSalesAgg._sum.total || 0) - monthSalesReturn);
  const monthCashReceived = Math.max(0, Number(monthSalesAgg._sum.paidAmount || 0) - monthCashRefund);

  const totalReceivables = Number(receivablesAgg._sum.balance || 0);
  const totalPayables = Number(payablesAgg._sum.balance || 0);
  const lowStockCount = lowStockRes[0]?.count ?? 0;
  const monthExpenses = Number(monthExpensesAgg._sum.amount || 0);

  // Compute returned COGS for gross profit calculation
  const monthSalesReturns = await prisma.salesReturn.findMany({
    where: { returnDate: { gte: monthStart, lt: monthEnd } },
    include: {
      items: {
        include: {
          product: {
            select: { costPrice: true }
          }
        }
      }
    }
  });

  let monthReturnedCOGS = 0;
  for (const ret of monthSalesReturns) {
    for (const item of ret.items) {
      monthReturnedCOGS += item.quantity * Number(item.product.costPrice);
    }
  }

  const monthCOGS = Number(monthCOGSRes[0]?.cogs || 0);
  const monthGrossProfit = monthSales - (monthCOGS - monthReturnedCOGS);
  const monthNetProfit = monthGrossProfit - monthExpenses;

  // Resolve top products details with sales returns deducted and invoice discounts factored in
  const netRevenueMap = {};
  for (const item of monthSalesItems) {
    const subtotal = Number(item.invoice?.subtotal || 0);
    const total = Number(item.invoice?.total || 0);
    const ratio = subtotal > 0 ? (total / subtotal) : 1;
    const netItemPrice = Number(item.totalPrice) * ratio;

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

  const topProducts = [];
  for (const item of sortedProductRevenues) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: { id: true, name: true, sku: true, size: true },
    });
    topProducts.push({
      productId: item.productId,
      name: product?.name || "Unknown",
      sku: product?.sku || "",
      size: product?.size || null,
      revenue: item.revenue,
    });
  }

  return {
    todaySales,
    todaySalesReturn,
    weekSales,
    monthSales,
    monthSalesReturn,
    monthCashReceived,
    totalReceivables,
    totalPayables,
    lowStockCount,
    topProducts,
    monthExpenses,
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

  const salesmen = await prisma.salesman.findMany({
    where: { isActive: true },
  });

  const result = [];
  for (const s of salesmen) {
    const [grossAgg, returnsAgg] = await Promise.all([
      prisma.invoice.aggregate({
        _sum: { total: true },
        where: {
          salesmanId: s.id,
          invoiceDate: { gte: fromDate, lte: toDate },
        },
      }),
      prisma.salesReturn.aggregate({
        _sum: { totalAmount: true },
        where: {
          invoice: { salesmanId: s.id },
          returnDate: { gte: fromDate, lte: toDate },
        },
      }),
    ]);

    const gross = Number(grossAgg._sum.total || 0);
    const returns = Number(returnsAgg._sum.totalAmount || 0);
    const net = gross - returns;

    result.push({
      salesmanId: s.id,
      salesmanName: s.name,
      gross,
      returns,
      net,
    });
  }

  return result.sort((a, b) => b.net - a.net);
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
  });

  let totalValueAtCost = 0;
  let totalValueAtSelling = 0;

  const list = products.map((p) => {
    const qty = p.stockQuantity;
    const cost = Number(p.costPrice);
    const selling = Number(p.sellingPrice);
    const valCost = qty * cost;
    const valSelling = qty * selling;

    totalValueAtCost += valCost;
    totalValueAtSelling += valSelling;

    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      size: p.size,
      stockQuantity: qty,
      costPrice: cost,
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
  });

  const result = [];
  const now = new Date();

  for (const customer of customers) {
    const openInvoices = await prisma.invoice.findMany({
      where: {
        customerId: customer.id,
        balanceDue: { gt: 0 },
      },
    });

    let bucket30 = 0;
    let bucket60 = 0;
    let bucketOver = 0;

    for (const inv of openInvoices) {
      const diffTime = Math.abs(now - new Date(inv.invoiceDate));
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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
 * Calculates gross profit using snapshotted cost prices.
 */
async function profitReport(from, to) {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  // Fetch sales returns in the period to calculate returned revenue and returned COGS
  const salesReturns = await prisma.salesReturn.findMany({
    where: { returnDate: { gte: fromDate, lte: toDate } },
    include: {
      items: {
        include: {
          product: { select: { costPrice: true } }
        }
      }
    }
  });

  let returnedRevenue = 0;
  let returnedCOGS = 0;
  for (const ret of salesReturns) {
    returnedRevenue += Number(ret.totalAmount || 0);
    for (const item of ret.items) {
      returnedCOGS += item.quantity * Number(item.product.costPrice);
    }
  }

  const [totalSalesAgg, cogsRes] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: { invoiceDate: { gte: fromDate, lte: toDate } },
    }),
    prisma.$queryRaw`
      SELECT COALESCE(SUM(ii."costPriceAtSale" * ii.quantity), 0)::numeric AS cogs
      FROM "InvoiceItem" ii
      JOIN "Invoice" i ON ii."invoiceId" = i.id
      WHERE i."invoiceDate" >= ${fromDate} AND i."invoiceDate" <= ${toDate}
    `
  ]);

  const sales = Number(totalSalesAgg._sum.total || 0) - returnedRevenue;
  const cogs = Number(cogsRes[0]?.cogs || 0) - returnedCOGS;
  const grossProfit = sales - cogs;

  return grossProfit;
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
 * Evaluates net profit margins (gross profit minus total expenses).
 */
async function netProfitReport(from, to) {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  // Fetch sales returns in the period to calculate returned revenue and returned COGS
  const salesReturns = await prisma.salesReturn.findMany({
    where: { returnDate: { gte: fromDate, lte: toDate } },
    include: {
      items: {
        include: {
          product: { select: { costPrice: true } }
        }
      }
    }
  });

  let returnedRevenue = 0;
  let returnedCOGS = 0;
  for (const ret of salesReturns) {
    returnedRevenue += Number(ret.totalAmount || 0);
    for (const item of ret.items) {
      returnedCOGS += item.quantity * Number(item.product.costPrice);
    }
  }

  const [totalSalesAgg, cogsRes, expensesAgg] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: { invoiceDate: { gte: fromDate, lte: toDate } },
    }),
    prisma.$queryRaw`
      SELECT COALESCE(SUM(ii."costPriceAtSale" * ii.quantity), 0)::numeric AS cogs
      FROM "InvoiceItem" ii
      JOIN "Invoice" i ON ii."invoiceId" = i.id
      WHERE i."invoiceDate" >= ${fromDate} AND i."invoiceDate" <= ${toDate}
    `,
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        expenseDate: { gte: fromDate, lte: toDate },
      },
    }),
  ]);

  const sales = Number(totalSalesAgg._sum.total || 0) - returnedRevenue;
  const cogs = Number(cogsRes[0]?.cogs || 0) - returnedCOGS;
  const grossProfit = sales - cogs;
  const totalExpenses = Number(expensesAgg._sum.amount || 0);
  const netProfit = grossProfit - totalExpenses;

  return {
    grossProfit,
    totalExpenses,
    netProfit,
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
    const name = item.product?.name || "Unknown Product";
    const subtotal = Number(item.invoice?.subtotal || 0);
    const total = Number(item.invoice?.total || 0);
    const ratio = subtotal > 0 ? (total / subtotal) : 1;
    const netItemPrice = Number(item.totalPrice) * ratio;

    productSales[name] = (productSales[name] || 0) + netItemPrice;
  }

  for (const item of returnedItems) {
    const name = item.product?.name || "Unknown Product";
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
    const subtotal = Number(item.invoice?.subtotal || 0);
    const total = Number(item.invoice?.total || 0);
    const ratio = subtotal > 0 ? (total / subtotal) : 1;
    const netItemPrice = Number(item.totalPrice) * ratio;

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

module.exports = {
  getDashboardMetrics,
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

