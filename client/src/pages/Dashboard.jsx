import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { LayoutDashboard, TrendingUp, AlertTriangle, Users, Truck, ArrowUpRight, DollarSign, Wallet, ArrowDownRight, Package, Database } from "lucide-react";

const COLORS = ["#0284c7", "#38bdf8", "#0ea5e9", "#7dd3fc", "#bae6fd"];

const Dashboard = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [salesTrend, setSalesTrend] = useState([]);
  const [salesmanData, setSalesmanData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [backingUp, setBackingUp] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [metricsRes, salesRes, salesmanRes] = await Promise.all([
        api.get("/api/report/dashboard"),
        api.get(`/api/report/sales`),
        api.get(`/api/report/sales-by-salesman`)
      ]);

      if (metricsRes.data?.type === "success") setMetrics(metricsRes.data.data);
      if (salesRes.data?.type === "success") {
        // Format daily dates for charting e.g. 2026-07-16 -> 16 Jul
        const formattedSales = salesRes.data.data.map(item => {
          // item.date is an ISO string like "2026-07-16" from Postgres DATE_TRUNC
          const rawDate = item.date || item.day || item.invoiceDate;
          let label = rawDate;
          try {
            // Force UTC parsing so "2026-07-16" becomes Jul 16, not shifted by timezone
            const d = new Date(rawDate + "T00:00:00Z");
            if (!isNaN(d.getTime())) {
              label = d.toLocaleDateString("en-US", { day: "numeric", month: "short", timeZone: "UTC" });
            }
          } catch (_) {}
          return {
            name: label,
            Sales: Number(item.total || item.totalSales || 0)
          };
        });
        setSalesTrend(formattedSales); // chronological order
      }
      if (salesmanRes.data?.type === "success") {
        const formattedSalesmen = salesmanRes.data.data.map(item => ({
          name: item.salesmanName,
          Sales: Number(item.net || item.gross || 0)
        }));
        setSalesmanData(formattedSalesmen);
      }
    } catch (err) {
      console.error("Dashboard metrics load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBackup = async () => {
    try {
      setBackingUp(true);
      const response = await api.get("/api/system/backup", { responseType: "blob" });
      
      const blob = new Blob([response.data], { type: "application/sql" });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      
      const contentDisposition = response.headers["content-disposition"];
      let filename = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}.sql`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }
      
      link.href = downloadUrl;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Backup failed:", err);
      alert("Failed to download database backup. Make sure you are logged in as an Administrator.");
    } finally {
      setBackingUp(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading || !metrics) {
    return (
      <div className="flex justify-center items-center py-20 min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Key cards configuration
  const statCards = [
    {
      title: "Today's Sales",
      value: `Rs. ${metrics.todaySales.toLocaleString()}`,
      description: "Counter & Credit sales today",
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10"
    },
    {
      title: "Monthly Sales & Collection",
      value: `Rs. ${metrics.monthSales.toLocaleString()}`,
      description: "Sales from 1st of month till date",
      icon: TrendingUp,
      color: "text-sky-600",
      bg: "bg-sky-500/10",
      isMonthlySales: true,
      cashReceived: metrics.monthCashReceived,
      salesPercentage: metrics.monthSales > 0 ? (metrics.monthCashReceived / metrics.monthSales) * 100 : 0
    },
    {
      title: "Total Receivables",
      value: `Rs. ${metrics.totalReceivables.toLocaleString()}`,
      description: "Credit balances owed by customers",
      icon: Wallet,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      link: "/reports?tab=customer-ledger"
    },
    {
      title: "Total Payables",
      value: `Rs. ${metrics.totalPayables.toLocaleString()}`,
      description: "Credit balance owed to suppliers",
      icon: Truck,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      link: "/reports?tab=supplier-ledger"
    },
    {
      title: "Monthly Expenses",
      value: `Rs. ${metrics.monthExpenses.toLocaleString()}`,
      description: "Accumulated overheads this month",
      icon: ArrowDownRight,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
      link: "/expenses"
    },
    {
      title: "Monthly Net Profit",
      value: `Rs. ${metrics.monthNetProfit.toLocaleString()}`,
      description: "Profit after COGS & Expenses",
      icon: DollarSign,
      color: metrics.monthNetProfit >= 0 ? "text-sky-600" : "text-rose-600",
      bg: metrics.monthNetProfit >= 0 ? "bg-sky-500/10" : "bg-rose-500/10",
      link: "/reports?tab=financials"
    },
    {
      title: "Low Stock Items",
      value: `${metrics.lowStockCount} items`,
      description: "Products below reorder threshold",
      icon: AlertTriangle,
      color: metrics.lowStockCount > 0 ? "text-amber-500" : "text-emerald-500",
      bg: metrics.lowStockCount > 0 ? "bg-amber-500/10" : "bg-emerald-500/10",
      link: "/reports?tab=inventory"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Business Overview</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Welcome back, {user?.name || "operator"}. Here is today's summary for Sameer Distributors.
          </p>
        </div>
        {user?.role === "ADMIN" && (
          <button
            onClick={handleBackup}
            disabled={backingUp}
            className="flex items-center justify-center px-4 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 text-white text-sm font-semibold rounded-xl shadow-md hover:shadow-lg hover:shadow-sky-500/10 active:scale-[0.98] transition-all duration-200"
          >
            {backingUp ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Backing up...
              </>
            ) : (
              <>
                <Database className="mr-2" size={16} />
                Backup Database
              </>
            )}
          </button>
        )}
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statCards.map((card, idx) => {
          const Icon = card.icon;
          const Wrapper = card.link ? Link : "div";
          return (
            <Wrapper
              key={idx}
              to={card.link}
              className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm flex items-center justify-between transition-all hover:shadow-md ${
                card.link ? "cursor-pointer hover:border-slate-350" : ""
              }`}
            >
              <div className="space-y-1 w-full mr-2">
                <p className="text-xs text-slate-405 uppercase font-semibold">{card.title}</p>
                <h3 className="text-xl font-black text-slate-900 dark:text-white">{card.value}</h3>
                
                {card.isMonthlySales ? (
                  <div className="mt-2.5 space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                    <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                      <span>Cash Collected:</span>
                      <span className="text-emerald-500 dark:text-emerald-400 font-bold">Rs. {card.cashReceived.toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                        style={{ width: `${card.salesPercentage}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-slate-400 font-medium">
                      {card.salesPercentage.toFixed(0)}% collected • {card.description}
                    </p>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400">{card.description}</p>
                )}
              </div>
              <div className={`p-3.5 rounded-xl ${card.color} ${card.bg}`}>
                <Icon size={20} />
              </div>
            </Wrapper>
          );
        })}
      </div>

      {/* Recharts Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Trend Chart */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">Daily Sales Trend</h3>
            <p className="text-xs text-slate-400">Chronological billing volumes (last 7 days)</p>
          </div>
          <div className="h-72 text-xs font-semibold">
            {salesTrend.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">No sales transactions available.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={salesTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip formatter={(value) => [`Rs. ${value.toLocaleString()}`, "Sales"]} />
                  <Line type="monotone" dataKey="Sales" stroke="#0284c7" strokeWidth={3} activeDot={{ r: 8 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Salesman leaderboard */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">Salesman Leaderboard</h3>
            <p className="text-xs text-slate-400">Net revenue achievements by distribution salesmen</p>
          </div>
          <div className="h-72 text-xs font-semibold">
            {salesmanData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-slate-400">No salesmen sales recorded.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesmanData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip formatter={(value) => [`Rs. ${value.toLocaleString()}`, "Sales"]} />
                  <Bar dataKey="Sales" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Top selling products & Low stock alerts widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top selling products list */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">Top 5 Revenue Products</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider pb-2">
                  <th className="pb-2">SKU Code</th>
                  <th className="pb-2">Product Name</th>
                  <th className="pb-2 text-right">Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {metrics.topProducts?.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-400 italic">No sales invoiced.</td>
                  </tr>
                ) : (
                  metrics.topProducts?.map((p, idx) => (
                    <tr key={idx} className="text-slate-700 dark:text-slate-350">
                      <td className="py-3 font-mono font-bold">{p.sku}</td>
                      <td className="py-3 font-semibold text-slate-900 dark:text-white capitalize">{p.name}</td>
                      <td className="py-3 text-right font-black text-sky-600 dark:text-sky-400">Rs. {p.revenue.toLocaleString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low stock alert table widget */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-4 flex flex-col">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center">
            <AlertTriangle className="text-amber-500 mr-2" size={16} /> Reorder Alerts
          </h3>
          <div className="flex-1 flex flex-col justify-center items-center text-center py-6">
            {metrics.lowStockCount > 0 ? (
              <div className="space-y-3">
                <div className="p-3 bg-amber-500/10 rounded-full text-amber-500 w-fit mx-auto">
                  <AlertTriangle size={32} />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white">{metrics.lowStockCount} items require reordering</h4>
                <p className="text-xs text-slate-400 max-w-xs">Some active SKU pieces have dropped below low stock levels.</p>
                <Link
                  to="/reports?tab=inventory"
                  className="inline-flex items-center text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline pt-1"
                >
                  Open Low Stock Report <ArrowUpRight size={14} className="ml-1" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-500/10 rounded-full text-emerald-500 w-fit mx-auto">
                  <Package size={32} />
                </div>
                <h4 className="font-bold text-slate-900 dark:text-white">Store stock levels healthy</h4>
                <p className="text-xs text-slate-400">All inventory items are adequately stocked above reorder thresholds.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
