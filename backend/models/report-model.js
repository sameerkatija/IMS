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
    topProductsRaw,
    monthGrossProfitRes,
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
    prisma.invoiceItem.groupBy({
      by: ["productId"],
      _sum: { totalPrice: true },
      where: {
        invoice: { invoiceDate: { gte: monthStart, lt: monthEnd } },
      },
      orderBy: {
        _sum: { totalPrice: "desc" },
      },
      take: 5,
    }),
    prisma.$queryRaw`
      SELECT (
        SELECT COALESCE(SUM(total), 0)
        FROM "Invoice"
        WHERE "invoiceDate" >= ${monthStart} AND "invoiceDate" < ${monthEnd}
      )::numeric -
      COALESCE(
        SUM(ii."costPriceAtSale" * ii.quantity),
        0
      )::numeric AS profit
      FROM "InvoiceItem" ii
      JOIN "Invoice" i ON ii."invoiceId" = i.id
      WHERE i."invoiceDate" >= ${monthStart} AND i."invoiceDate" < ${monthEnd}
    `,
  ]);

  const todaySales = Number(todaySalesAgg._sum.total || 0);
  const weekSales = Number(weekSalesAgg._sum.total || 0);
  const monthSales = Number(monthSalesAgg._sum.total || 0);
  const monthCashReceived = Number(monthSalesAgg._sum.paidAmount || 0);
  const totalReceivables = Number(receivablesAgg._sum.balance || 0);
  const totalPayables = Number(payablesAgg._sum.balance || 0);
  const lowStockCount = lowStockRes[0]?.count ?? 0;
  const monthExpenses = Number(monthExpensesAgg._sum.amount || 0);
  const monthGrossProfit = Number(monthGrossProfitRes[0]?.profit || 0);
  const monthNetProfit = monthGrossProfit - monthExpenses;

  // Resolve top products details
  const topProducts = [];
  for (const item of topProductsRaw) {
    const product = await prisma.product.findUnique({
      where: { id: item.productId },
      select: { id: true, name: true, sku: true },
    });
    topProducts.push({
      productId: item.productId,
      name: product?.name || "Unknown",
      sku: product?.sku || "",
      revenue: Number(item._sum.totalPrice || 0),
    });
  }

  return {
    todaySales,
    weekSales,
    monthSales,
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
      id, name, sku, "stockQuantity", "lowStockLevel",
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

  const result = await prisma.$queryRaw`
    SELECT (
      SELECT COALESCE(SUM(total), 0)
      FROM "Invoice"
      WHERE "invoiceDate" >= ${fromDate} AND "invoiceDate" <= ${toDate}
    )::numeric -
    COALESCE(
      SUM(ii."costPriceAtSale" * ii.quantity),
      0
    )::numeric AS profit
    FROM "InvoiceItem" ii
    JOIN "Invoice" i ON ii."invoiceId" = i.id
    WHERE i."invoiceDate" >= ${fromDate} AND i."invoiceDate" <= ${toDate}
  `;

  return Number(result[0]?.profit || 0);
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

  const [grossProfitRes, expensesAgg] = await Promise.all([
    prisma.$queryRaw`
      SELECT (
        SELECT COALESCE(SUM(total), 0)
        FROM "Invoice"
        WHERE "invoiceDate" >= ${fromDate} AND "invoiceDate" <= ${toDate}
      )::numeric -
      COALESCE(
        SUM(ii."costPriceAtSale" * ii.quantity),
        0
      )::numeric AS profit
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

  const grossProfit = Number(grossProfitRes[0]?.profit || 0);
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

  const items = await prisma.invoiceItem.findMany({
    where: {
      invoice: {
        invoiceDate: { gte: fromDate, lte: toDate },
      },
    },
    include: {
      product: true,
    },
  });

  const productSales = {};
  for (const item of items) {
    const name = item.product?.name || "Unknown Product";
    const amount = Number(item.totalPrice) || 0;
    productSales[name] = (productSales[name] || 0) + amount;
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
    },
  });

  const categorySales = {};
  for (const item of items) {
    const name = item.product?.category?.name || "Uncategorized";
    const amount = Number(item.totalPrice) || 0;
    categorySales[name] = (categorySales[name] || 0) + amount;
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

