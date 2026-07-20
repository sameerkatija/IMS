import React, { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../services/api";
import { BarChart3, Calendar, FileText, Printer, AlertTriangle, ArrowRight, ArrowLeft, TrendingUp, DollarSign, Wallet } from "lucide-react";
import Toast from "../components/Toast";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { formatCurrency, formatCurrencyNoDecimals } from "../utils/format";

const CHART_COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#3b82f6", "#14b8a6"];

const Reports = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "financials");
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  // Date Range (default last 7 days)
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    // Default to 1st of current month
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().substring(0, 10);
  });
  const [toDate, setToDate] = useState(new Date().toISOString().substring(0, 10));

  // Financial Data
  const [profitData, setProfitData] = useState(0);
  const [expenseData, setExpenseData] = useState([]);
  const [netProfitData, setNetProfitData] = useState(null);
  const [productSalesData, setProductSalesData] = useState([]);
  const [categorySalesData, setCategorySalesData] = useState([]);

  // Stock Reports
  const [stockValuation, setStockValuation] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);

  // Receivables/Payables
  const [receivables, setReceivables] = useState([]);
  const [payables, setPayables] = useState([]);

  // Detailed Ledger Sheets
  const [selectedCustomerId, setSelectedCustomerId] = useState(searchParams.get("customerId") || "");
  const [selectedCustomerLedger, setSelectedCustomerLedger] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState(searchParams.get("supplierId") || "");
  const [selectedSupplierLedger, setSelectedSupplierLedger] = useState([]);

  // Dropdown lists
  const [allCustomers, setAllCustomers] = useState([]);
  const [allSuppliers, setAllSuppliers] = useState([]);

  const loadFinancials = async () => {
    try {
      setLoading(true);
      const [profitRes, expRes, netRes, prodSalesRes, catSalesRes] = await Promise.all([
        api.get(`/api/report/profit?from=${fromDate}&to=${toDate}`),
        api.get(`/api/report/expense?from=${fromDate}&to=${toDate}`),
        api.get(`/api/report/net-profit?from=${fromDate}&to=${toDate}`),
        api.get(`/api/report/sales-by-product?from=${fromDate}&to=${toDate}`),
        api.get(`/api/report/sales-by-category?from=${fromDate}&to=${toDate}`)
      ]);
      
      if (profitRes.data?.type === "success") setProfitData(profitRes.data.data.profit);
      if (expRes.data?.type === "success") setExpenseData(expRes.data.data);
      if (netRes.data?.type === "success") setNetProfitData(netRes.data.data);
      if (prodSalesRes.data?.type === "success") setProductSalesData(prodSalesRes.data.data);
      if (catSalesRes.data?.type === "success") setCategorySalesData(catSalesRes.data.data);
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load financial reports.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const loadStockReports = async () => {
    try {
      setLoading(true);
      const [valRes, lowRes] = await Promise.all([
        api.get("/api/report/current-stock"),
        api.get("/api/report/low-stock")
      ]);
      if (valRes.data?.type === "success") setStockValuation(valRes.data.data?.products || []);
      if (lowRes.data?.type === "success") setLowStockProducts(lowRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadLedgers = async () => {
    try {
      setLoading(true);
      const [recRes, payRes, custRes, suppRes] = await Promise.all([
        api.get("/api/report/customer-ledger"),
        api.get("/api/report/supplier-ledger"),
        api.get("/api/customer?limit=100"),
        api.get("/api/supplier?limit=100")
      ]);
      if (recRes.data?.type === "success") setReceivables(recRes.data.data);
      if (payRes.data?.type === "success") setPayables(payRes.data.data);
      if (custRes.data?.type === "success") setAllCustomers(custRes.data.data);
      if (suppRes.data?.type === "success") setAllSuppliers(suppRes.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomerLedgerDetails = async (id) => {
    if (!id) {
      setSelectedCustomerLedger([]);
      return;
    }
    try {
      setLoading(true);
      const response = await api.get(`/api/customer/${id}/ledger`);
      if (response.data && response.data.type === "success") {
        setSelectedCustomerLedger(response.data.data);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load customer statement.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplierLedgerDetails = async (id) => {
    if (!id) {
      setSelectedSupplierLedger([]);
      return;
    }
    try {
      setLoading(true);
      const response = await api.get(`/api/supplier/${id}/ledger`);
      if (response.data && response.data.type === "success") {
        setSelectedSupplierLedger(response.data.data);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load supplier statement.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // Synchronize Tab and URL params
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) setActiveTab(tabParam);
    
    const custParam = searchParams.get("customerId");
    if (custParam) {
      setSelectedCustomerId(custParam);
      fetchCustomerLedgerDetails(custParam);
    }
    
    const suppParam = searchParams.get("supplierId");
    if (suppParam) {
      setSelectedSupplierId(suppParam);
      fetchSupplierLedgerDetails(suppParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (activeTab === "financials") {
      loadFinancials();
    } else if (activeTab === "inventory") {
      loadStockReports();
    } else if (activeTab === "customer-ledger" || activeTab === "supplier-ledger") {
      loadLedgers();
      if (activeTab === "customer-ledger" && selectedCustomerId) {
        fetchCustomerLedgerDetails(selectedCustomerId);
      } else if (activeTab === "supplier-ledger" && selectedSupplierId) {
        fetchSupplierLedgerDetails(selectedSupplierId);
      }
    }
  }, [activeTab, fromDate, toDate]);

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    setSearchParams({ tab: tabName });
    // Reset specific states
    if (tabName !== "customer-ledger") {
      setSelectedCustomerId("");
      setSelectedCustomerLedger([]);
    }
    if (tabName !== "supplier-ledger") {
      setSelectedSupplierId("");
      setSelectedSupplierLedger([]);
    }
  };

  const selectCustomerLedger = (id) => {
    setSelectedCustomerId(id);
    setSearchParams({ tab: "customer-ledger", customerId: id });
    fetchCustomerLedgerDetails(id);
  };

  const selectSupplierLedger = (id) => {
    setSelectedSupplierId(id);
    setSearchParams({ tab: "supplier-ledger", supplierId: id });
    fetchSupplierLedgerDetails(id);
  };

  const handlePrint = () => {
    window.print();
  };

  const totalExpense = expenseData.reduce((acc, curr) => acc + Number(curr.totalAmount), 0);

  return (
    <div className="space-y-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex justify-between items-center no-print">
        <nav className="flex space-x-8 text-sm font-medium">
          <button
            onClick={() => handleTabChange("financials")}
            className={`py-4 border-b-2 px-1 transition-all ${
              activeTab === "financials"
                ? "border-sky-600 text-sky-600 dark:text-sky-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Profit & Loss Financials
          </button>
          <button
            onClick={() => handleTabChange("inventory")}
            className={`py-4 border-b-2 px-1 transition-all ${
              activeTab === "inventory"
                ? "border-sky-600 text-sky-600 dark:text-sky-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Inventory Valuations
          </button>
          <button
            onClick={() => handleTabChange("customer-ledger")}
            className={`py-4 border-b-2 px-1 transition-all ${
              activeTab === "customer-ledger"
                ? "border-sky-600 text-sky-600 dark:text-sky-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Customer Receivables Ledger
          </button>
          <button
            onClick={() => handleTabChange("supplier-ledger")}
            className={`py-4 border-b-2 px-1 transition-all ${
              activeTab === "supplier-ledger"
                ? "border-sky-600 text-sky-600 dark:text-sky-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Supplier Payables Ledger
          </button>
        </nav>
      </div>

      {activeTab === "financials" && (
        /* FINANCIAL REPORTS TAB */
        <div className="space-y-6 no-print">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 dark:border-slate-800 pb-4 gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Profit &amp; Loss Statement</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Revenue minus COGS gives Gross Profit. Deduct overheads to get Net Profit/Loss.
              </p>
            </div>
            {/* Date Pickers + Quick Presets */}
            <div className="flex flex-col gap-2 items-end">
              {/* Quick presets */}
              <div className="flex gap-1.5 flex-wrap justify-end">
                {[
                  {
                    label: "This Month",
                    fn: () => {
                      const d = new Date();
                      setFromDate(new Date(d.getFullYear(), d.getMonth(), 1).toISOString().substring(0, 10));
                      setToDate(new Date().toISOString().substring(0, 10));
                    }
                  },
                  {
                    label: "Last Month",
                    fn: () => {
                      const d = new Date();
                      const first = new Date(d.getFullYear(), d.getMonth() - 1, 1);
                      const last = new Date(d.getFullYear(), d.getMonth(), 0);
                      setFromDate(first.toISOString().substring(0, 10));
                      setToDate(last.toISOString().substring(0, 10));
                    }
                  },
                  {
                    label: "This Year",
                    fn: () => {
                      const d = new Date();
                      setFromDate(new Date(d.getFullYear(), 0, 1).toISOString().substring(0, 10));
                      setToDate(new Date().toISOString().substring(0, 10));
                    }
                  },
                  {
                    label: "All Time",
                    fn: () => {
                      setFromDate("2000-01-01");
                      setToDate(new Date().toISOString().substring(0, 10));
                    }
                  },
                ].map(({ label, fn }) => (
                  <button
                    key={label}
                    onClick={fn}
                    className="px-2.5 py-1 text-[11px] font-semibold rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-sky-50 dark:hover:bg-sky-950/30 hover:border-sky-300 hover:text-sky-600 dark:hover:text-sky-400 transition-all"
                  >
                    {label}
                  </button>
                ))}
              </div>
              {/* Manual inputs */}
              <div className="flex items-center space-x-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400">
                <Calendar size={14} className="text-slate-400" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs"
                />
                <span className="text-slate-300">to</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-transparent border-none outline-none text-xs"
                />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6">

              {/* ===== TOP KPI CARDS ===== */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Gross Profit */}
                <div className={`p-6 rounded-2xl border shadow-sm ${
                  Number(profitData) >= 0
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40"
                    : "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40"
                }`}>
                  <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Gross Profit</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Revenue minus Cost of Goods Sold</p>
                  <h3 className={`text-2xl font-black mt-3 ${
                    Number(profitData) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}>
                    {Number(profitData) < 0 ? "- " : ""}Rs. {Math.abs(Number(profitData)).toLocaleString()}
                  </h3>
                  <p className={`text-xs font-semibold mt-1 ${
                    Number(profitData) >= 0 ? "text-emerald-500" : "text-rose-500"
                  }`}>
                    {Number(profitData) >= 0 ? "▲ Profitable" : "▼ Loss on COGS"}
                  </p>
                </div>

                {/* Total Expenses */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm">
                  <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">Total Overheads</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{expenseData.length} expense categories</p>
                  <h3 className="text-2xl font-black mt-3 text-rose-600 dark:text-rose-455">
                    Rs. {Number(totalExpense).toLocaleString()}
                  </h3>
                  <p className="text-xs font-semibold mt-1 text-rose-400">▼ Operating Costs</p>
                </div>

                {/* Net Profit */}
                <div className={`p-6 rounded-2xl border shadow-sm ${
                  (netProfitData?.netProfit ?? 0) >= 0
                    ? "bg-sky-50 dark:bg-sky-950/20 border-sky-200 dark:border-sky-900/40"
                    : "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40"
                }`}>
                  <p className="text-xs text-slate-500 uppercase font-semibold tracking-wider">
                    {(netProfitData?.netProfit ?? 0) >= 0 ? "Net Profit" : "Net Loss"}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Overheads &amp; deductions factored</p>
                  <h3 className={`text-2xl font-black mt-3 ${
                    (netProfitData?.netProfit ?? 0) >= 0 ? "text-sky-600 dark:text-sky-400" : "text-rose-600 dark:text-rose-400"
                  }`}>
                    {(netProfitData?.netProfit ?? 0) < 0 ? "− " : ""}Rs. {Math.abs(Number(netProfitData?.netProfit || 0)).toLocaleString()}
                  </h3>
                  <p className={`text-xs font-semibold mt-1 ${
                    (netProfitData?.netProfit ?? 0) >= 0 ? "text-sky-500" : "text-rose-500"
                  }`}>
                    {(netProfitData?.netProfit ?? 0) >= 0 ? "▲ In the black" : "▼ In the red"}
                  </p>
                </div>
              </div>

              {/* ===== DYNAMIC OVERHEAD EXPENSE BREAKDOWN (PIE CHART ONLY) ===== */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 mb-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                      Overhead Expense Distribution
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Visual breakdown of all active overhead accounts</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                    {expenseData.length} active categories
                  </span>
                </div>

                {expenseData.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-12">No expenses logged during this period.</p>
                ) : (
                  <div className="flex flex-col md:flex-row items-center justify-around gap-6">
                    {/* The Chart */}
                    <div className="h-72 w-full max-w-lg">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={expenseData.filter(exp => Math.abs(Number(exp.totalAmount)) > 0).map((exp) => ({
                              name: exp.categoryName,
                              value: Math.abs(Number(exp.totalAmount))
                            }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={70}
                            paddingAngle={5}
                            dataKey="value"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                          >
                            {expenseData.filter(exp => Math.abs(Number(exp.totalAmount)) > 0).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [`Rs. ${Number(value).toLocaleString()}`, "Amount"]} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Dynamic Legend / Category Badges representing all categories */}
                    <div className="w-full max-w-sm space-y-3.5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Expense Account Status</h4>
                      <div className="grid grid-cols-1 gap-2.5">
                        {expenseData.map((exp, index) => {
                          const amount = Number(exp.totalAmount);
                          const hasActivity = Math.abs(amount) > 0;
                          return (
                            <div
                              key={exp.categoryId}
                              className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
                                hasActivity
                                  ? "bg-slate-50/50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800"
                                  : "bg-slate-50/20 dark:bg-slate-950/10 border-dashed border-slate-200 dark:border-slate-800 opacity-60"
                              }`}
                            >
                              <div className="flex items-center space-x-2.5">
                                <span
                                  className="w-3 h-3 rounded-full flex-shrink-0"
                                  style={{
                                    backgroundColor: hasActivity
                                      ? CHART_COLORS[index % CHART_COLORS.length]
                                      : "#94a3b8"
                                  }}
                                />
                                <span className="text-xs font-semibold capitalize text-slate-700 dark:text-slate-350">
                                  {exp.categoryName}
                                </span>
                              </div>
                              <span className={`text-xs font-bold ${amount < 0 ? "text-emerald-500" : hasActivity ? "text-slate-900 dark:text-white" : "text-slate-400"}`}>
                                {amount === 0
                                  ? "Rs. 0 (No activity)"
                                  : amount < 0
                                  ? `− Rs. ${Math.abs(amount).toLocaleString()} (Net Gain)`
                                  : `Rs. ${amount.toLocaleString()}`}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ===== GROSS SALES CHARTS FOR CATEGORY & PRODUCTS ===== */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Category Gross Sales Chart */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Gross Sales by Category</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Revenue breakdown across product groups</p>
                  </div>
                  
                  <div className="h-72 flex justify-center items-center">
                    {categorySalesData.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">No category sales recorded.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categorySalesData}
                            cx="50%"
                            cy="50%"
                            innerRadius={0}
                            outerRadius={65}
                            labelLine={true}
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            dataKey="value"
                          >
                            {categorySalesData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={CHART_COLORS[(index + 2) % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => [`Rs. ${Number(value).toLocaleString()}`, "Sales"]} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                {/* Top Selling Products Bar Chart */}
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Top Product sales</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Top products generated revenue comparison</p>
                  </div>

                  <div className="h-72">
                    {productSalesData.length === 0 ? (
                      <div className="h-full flex justify-center items-center">
                        <p className="text-xs text-slate-400 italic">No product sales recorded.</p>
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={productSalesData.slice(0, 5)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                          <XAxis type="number" stroke="#94a3b8" />
                          <YAxis dataKey="name" type="category" stroke="#94a3b8" width={100} />
                          <Tooltip formatter={(value) => [`Rs. ${Number(value).toLocaleString()}`, "Sales"]} />
                          <Bar dataKey="value" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>



            </div>
          )}
        </div>
      )}

      {activeTab === "inventory" && (
        /* INVENTORY VALUATION TAB */
        <div className="space-y-6 no-print">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Inventory Stock Valuation Reports</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Evaluates current asset pricing. Valued at purchase costs (investment) vs expected selling values.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Asset Valuation card */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm h-fit space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-2">Asset Value Summary</h3>
                
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-[10px] text-slate-450 uppercase font-semibold">Total Stock Units</p>
                    <p className="font-bold mt-0.5">{stockValuation.reduce((acc, curr) => acc + curr.stockQuantity, 0)} pieces</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-450 uppercase font-semibold">Total Investment (Asset Cost)</p>
                    <p className="font-bold text-slate-950 dark:text-white mt-0.5">
                      Rs. {Math.round(stockValuation.reduce((acc, curr) => acc + (curr.stockQuantity * Number(curr.costPrice)), 0)).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-450 uppercase font-semibold">Retail Valuation (Selling value)</p>
                    <p className="font-bold text-sky-600 mt-0.5">
                      Rs. {Math.round(stockValuation.reduce((acc, curr) => acc + (curr.stockQuantity * Number(curr.sellingPrice)), 0)).toLocaleString()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Low stock alerts panel */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <AlertTriangle size={16} className="text-amber-500 mr-2" /> Low Stock Items ({lowStockProducts.length})
                </h3>

                {lowStockProducts.length === 0 ? (
                  <p className="text-sm text-emerald-600 dark:text-emerald-450 text-center py-10 font-medium">All items are sufficiently stocked!</p>
                ) : (
                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="text-slate-400 font-semibold uppercase border-b border-slate-100 dark:border-slate-800 pb-2">
                          <th className="pb-2">SKU</th>
                          <th className="pb-2">Product</th>
                          <th className="pb-2 text-center">Threshold</th>
                          <th className="pb-2 text-right">Available</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {lowStockProducts.map((p) => (
                          <tr key={p.id} className="text-slate-700 dark:text-slate-350">
                            <td className="py-2.5 font-mono">{p.sku || "-"}</td>
                            <td className="py-2.5 font-semibold text-slate-950 dark:text-white capitalize">
                              {p.name}{p.size ? ` (${p.size})` : ""}
                            </td>
                            <td className="py-2.5 text-center text-slate-400">{p.lowStockLevel} pcs</td>
                            <td className="py-2.5 text-right font-bold text-rose-500">{p.stockQuantity} pcs</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "customer-ledger" && (
        /* CUSTOMER RECEIVABLES TAB & STATEMENT DETAIL */
        <div className="space-y-6">
          {!selectedCustomerId ? (
            /* LEDGER RECEIVABLES SUMMARY PAGE (with aging buckets) */
            <div className="space-y-6 no-print">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Accounts Receivables (Aging Analysis)</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Reviews customer accounts with outstanding balances. Balances are sorted by age since invoice generation.
                </p>
              </div>

              {loading && receivables.length === 0 ? (
                <div className="flex justify-center items-center py-20">
                  <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : receivables.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                  No outstanding receivables! All customers have paid.
                </p>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                          <th className="px-6 py-4">Customer Name</th>
                          <th className="px-6 py-4 text-right">0-30 Days</th>
                          <th className="px-6 py-4 text-right">31-60 Days</th>
                          <th className="px-6 py-4 text-right">60+ Days</th>
                          <th className="px-6 py-4 text-right font-bold">Total Balance Due</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {receivables.map((rec) => (
                          <tr key={rec.customerId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                            <td className="px-6 py-4 font-semibold text-slate-950 dark:text-white capitalize">{rec.customerName}</td>
                            <td className="px-6 py-4 text-right font-medium text-slate-500">Rs. {formatCurrencyNoDecimals(rec.aging["0-30 days"])}</td>
                            <td className="px-6 py-4 text-right font-medium text-amber-500">Rs. {formatCurrencyNoDecimals(rec.aging["31-60 days"])}</td>
                            <td className="px-6 py-4 text-right font-medium text-rose-500">Rs. {formatCurrencyNoDecimals(rec.aging["60+ days"])}</td>
                            <td className="px-6 py-4 text-right font-bold text-rose-600 dark:text-rose-455">
                              Rs. {formatCurrency(rec.outstandingBalance)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => selectCustomerLedger(rec.customerId)}
                                className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-lg border border-sky-200 dark:border-sky-900/40 transition-colors"
                              >
                                View statement <ArrowRight size={12} className="ml-1" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* DETAILED LEDGER SHEET FOR SINGLE CUSTOMER */
            <div className="space-y-6">
              {/* Back controls (no-print) */}
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4 no-print">
                <button
                  onClick={() => setSearchParams({ tab: "customer-ledger" })}
                  className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ArrowLeft className="mr-1.5" size={14} /> Back to Receivables aging
                </button>

                <div className="flex space-x-2">
                  <select
                    value={selectedCustomerId}
                    onChange={(e) => selectCustomerLedger(e.target.value)}
                    className="px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg outline-none font-semibold"
                  >
                    {allCustomers.map((cust) => (
                      <option key={cust.id} value={cust.id}>{cust.name}</option>
                    ))}
                  </select>

                  <button
                    onClick={handlePrint}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 rounded-lg border border-sky-200 dark:border-sky-900/40 hover:bg-sky-100 transition-colors"
                  >
                    <Printer size={12} className="mr-1.5" /> Print Statement
                  </button>
                </div>
              </div>

              {/* Printable sheet area */}
              <div className="print-area bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6 print:border-none print:shadow-none">
                <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-sky-600">Sameer Distributors</h1>
                    <p className="text-xs text-slate-500 mt-1">Chronological Account Statement</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Customer Ledger Sheet</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Date: {new Date().toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Account Profile</p>
                  <p className="font-bold text-slate-950 dark:text-white mt-0.5 capitalize">
                    {allCustomers.find(c => c.id === Number(selectedCustomerId))?.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Contact: {allCustomers.find(c => c.id === Number(selectedCustomerId))?.phone || "No number"}
                  </p>
                  <p className="text-xs text-slate-450 mt-0.5">
                    Address: {allCustomers.find(c => c.id === Number(selectedCustomerId))?.address || "No address details"}
                  </p>
                </div>

                {selectedCustomerLedger.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-10 font-semibold">No transactions logged on this account.</p>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider">
                          <th className="px-4 py-3">Timestamp</th>
                          <th className="px-4 py-3">Reference Source</th>
                          <th className="px-4 py-3">Description</th>
                          <th className="px-4 py-3 text-right">Debit (+)</th>
                          <th className="px-4 py-3 text-right">Credit (-)</th>
                          <th className="px-4 py-3 text-right font-bold">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {selectedCustomerLedger.map((ent) => (
                          <tr key={ent.id}>
                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-450">{new Date(ent.createdAt).toLocaleString()}</td>
                            <td className="px-4 py-2.5 font-bold font-mono text-slate-600 dark:text-slate-400">
                              {ent.referenceType} #{ent.referenceId}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">{ent.description || <span className="italic text-slate-400">No details</span>}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-rose-500">
                              {Number(ent.debit) > 0 ? `Rs. ${formatCurrency(ent.debit)}` : "-"}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-emerald-500">
                              {Number(ent.credit) > 0 ? `Rs. ${formatCurrency(ent.credit)}` : "-"}
                            </td>
                            <td className="px-4 py-2.5 text-right font-black text-slate-950 dark:text-white">
                              Rs. {formatCurrency(ent.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "supplier-ledger" && (
        /* SUPPLIER PAYABLES TAB & STATEMENT DETAIL */
        <div className="space-y-6">
          {!selectedSupplierId ? (
            /* SUPPLIER PAYABLES SUMMARY LIST */
            <div className="space-y-6 no-print">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Accounts Payables (Supplier balances)</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Reviews supplier balances owed for stock consignments.
                </p>
              </div>

              {loading && payables.length === 0 ? (
                <div className="flex justify-center items-center py-20">
                  <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : payables.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
                  No supplier debts! All payables are settled.
                </p>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                          <th className="px-6 py-4">Supplier/Company Name</th>
                          <th className="px-6 py-4">Phone</th>
                          <th className="px-6 py-4 text-right font-bold">Outstanding Owed</th>
                          <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {payables.map((pay) => (
                          <tr key={pay.supplierId} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                            <td className="px-6 py-4 font-semibold text-slate-950 dark:text-white capitalize">{pay.supplierName}</td>
                            <td className="px-6 py-4 text-slate-500 font-mono text-xs">{pay.phone || <span className="italic text-slate-400">No contact</span>}</td>
                            <td className="px-6 py-4 text-right font-bold text-amber-600 dark:text-amber-455">
                              Rs. {formatCurrency(pay.outstandingBalance)}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                onClick={() => selectSupplierLedger(pay.supplierId)}
                                className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-lg border border-sky-200 dark:border-sky-900/40 transition-colors"
                              >
                                View statement <ArrowRight size={12} className="ml-1" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* DETAILED STATEMENT SHEET FOR SUPPLIER */
            <div className="space-y-6">
              {/* Back controls (no-print) */}
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4 no-print">
                <button
                  onClick={() => setSearchParams({ tab: "supplier-ledger" })}
                  className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                >
                  <ArrowLeft className="mr-1.5" size={14} /> Back to Supplier payables
                </button>

                <div className="flex space-x-2">
                  <select
                    value={selectedSupplierId}
                    onChange={(e) => selectSupplierLedger(e.target.value)}
                    className="px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-lg outline-none font-semibold"
                  >
                    {allSuppliers.map((supp) => (
                      <option key={supp.id} value={supp.id}>{supp.name}</option>
                    ))}
                  </select>

                  <button
                    onClick={handlePrint}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 rounded-lg border border-sky-200 dark:border-sky-900/40 hover:bg-sky-100 transition-colors"
                  >
                    <Printer size={12} className="mr-1.5" /> Print Statement
                  </button>
                </div>
              </div>

              {/* Printable sheet area */}
              <div className="print-area bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6 print:border-none print:shadow-none">
                <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-sky-600">Sameer Distributors</h1>
                    <p className="text-xs text-slate-500 mt-1">Supplier Ledger Statement</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Supplier Statement Sheet</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Date: {new Date().toLocaleDateString()}</p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Supplier Account Profile</p>
                  <p className="font-bold text-slate-950 dark:text-white mt-0.5 capitalize">
                    {allSuppliers.find(s => s.id === Number(selectedSupplierId))?.name}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Contact: {allSuppliers.find(s => s.id === Number(selectedSupplierId))?.phone || "No phone number"}
                  </p>
                  <p className="text-xs text-slate-450 mt-0.5">
                    Address: {allSuppliers.find(s => s.id === Number(selectedSupplierId))?.address || "No address details"}
                  </p>
                </div>

                {selectedSupplierLedger.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-10 font-semibold">No transactions logged with this supplier.</p>
                ) : (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider">
                          <th className="px-4 py-3">Timestamp</th>
                          <th className="px-4 py-3">Reference Source</th>
                          <th className="px-4 py-3">Description / Notes</th>
                          <th className="px-4 py-3 text-right">Debit (-)</th>
                          <th className="px-4 py-3 text-right">Credit (+)</th>
                          <th className="px-4 py-3 text-right font-bold">Balance Owed</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {selectedSupplierLedger.map((ent) => (
                          <tr key={ent.id}>
                            <td className="px-4 py-2.5 text-slate-500 dark:text-slate-450">{new Date(ent.createdAt).toLocaleString()}</td>
                            <td className="px-4 py-2.5 font-bold font-mono text-slate-600 dark:text-slate-400">
                              {ent.referenceType} #{ent.referenceId}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">{ent.notes || <span className="italic text-slate-450">No details</span>}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-emerald-500">
                              {Number(ent.debit) > 0 ? `Rs. ${formatCurrency(ent.debit)}` : "-"}
                            </td>
                            <td className="px-4 py-2.5 text-right font-semibold text-rose-500">
                              {Number(ent.credit) > 0 ? `Rs. ${formatCurrency(ent.credit)}` : "-"}
                            </td>
                            <td className="px-4 py-2.5 text-right font-black text-slate-950 dark:text-white">
                              Rs. {formatCurrency(ent.balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Reports;
