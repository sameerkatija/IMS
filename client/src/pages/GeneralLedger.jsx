import React, { useState, useEffect } from "react";
import api from "../services/api";
import {
  BookOpen,
  Scale,
  TrendingUp,
  FileText,
  PlusCircle,
  AlertCircle,
  CheckCircle2,
  Search,
  Filter,
  DollarSign,
  Calendar,
  ShieldCheck,
} from "lucide-react";

export default function GeneralLedger() {
  const [activeTab, setActiveTab] = useState("trial-balance");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Filters
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Data states
  const [trialBalance, setTrialBalance] = useState({ accounts: [], totalDebit: 0, totalCredit: 0, isBalanced: true });
  const [profitAndLoss, setProfitAndLoss] = useState(null);
  const [journalEntries, setJournalEntries] = useState({ entries: [], total: 0 });
  const [journalPage, setJournalPage] = useState(1);
  const [referenceTypeFilter, setReferenceTypeFilter] = useState("");

  // Adjustment Modal States
  const [modalType, setModalType] = useState(null); // 'deposit' | 'credit-note' | 'debit-note' | 'write-off'
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);

  // Form states
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formSupplierId, setFormSupplierId] = useState("");
  const [formInvoiceId, setFormInvoiceId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formReason, setFormReason] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, [activeTab, fromDate, toDate, journalPage, referenceTypeFilter]);

  const fetchInitialData = async () => {
    setLoading(true);
    setError("");
    try {
      if (activeTab === "trial-balance") {
        const res = await api.get("/gl/trial-balance", { params: { from: fromDate, to: toDate } });
        setTrialBalance(res.data?.data || { accounts: [], totalDebit: 0, totalCredit: 0, isBalanced: true });
      } else if (activeTab === "profit-loss") {
        const res = await api.get("/gl/profit-loss", { params: { from: fromDate, to: toDate } });
        setProfitAndLoss(res.data?.data || null);
      } else if (activeTab === "journal-entries") {
        const res = await api.get("/gl/journal-entries", {
          params: { from: fromDate, to: toDate, referenceType: referenceTypeFilter, page: journalPage, limit: 30 },
        });
        setJournalEntries(res.data?.data || { entries: [], total: 0 });
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load General Ledger data.");
    } finally {
      setLoading(false);
    }
  };

  const openAdjustmentModal = async (type) => {
    setModalType(type);
    setFormCustomerId("");
    setFormSupplierId("");
    setFormInvoiceId("");
    setFormAmount("");
    setFormReason("");
    setError("");

    try {
      if (type === "deposit" || type === "credit-note") {
        const res = await api.get("/customer");
        setCustomers(res.data.data || []);
      } else if (type === "debit-note") {
        const res = await api.get("/supplier");
        setSuppliers(res.data.data || []);
      } else if (type === "write-off") {
        const res = await api.get("/invoice", { params: { status: "UNPAID" } });
        setUnpaidInvoices(res.data.data || []);
      }
    } catch (err) {
      setError("Failed to load entity options.");
    }
  };

  const handleAdjustmentSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccessMsg("");

    try {
      if (modalType === "deposit") {
        await api.post("/gl/customer-deposit", { customerId: formCustomerId, amount: formAmount, description: formReason });
        setSuccessMsg("Customer deposit posted successfully to GL!");
      } else if (modalType === "credit-note") {
        await api.post("/gl/credit-note", { customerId: formCustomerId, invoiceId: formInvoiceId || null, amount: formAmount, reason: formReason });
        setSuccessMsg("Credit note issued successfully!");
      } else if (modalType === "debit-note") {
        await api.post("/gl/debit-note", { supplierId: formSupplierId, purchaseId: formInvoiceId || null, amount: formAmount, reason: formReason });
        setSuccessMsg("Debit note issued successfully!");
      } else if (modalType === "write-off") {
        await api.post("/gl/bad-debt-writeoff", { invoiceId: formInvoiceId, reason: formReason });
        setSuccessMsg("Bad debt written off cleanly!");
      }
      setModalType(null);
      fetchInitialData();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to process adjustment.");
    } finally {
      setLoading(false);
    }
  };

  const formatRs = (val) => `Rs. ${Number(val || 0).toLocaleString("en-PK", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-2xl border border-slate-800 text-white">
        <div>
          <div className="flex items-center gap-3">
            <BookOpen className="text-sky-400" size={28} />
            <h1 className="text-2xl font-bold tracking-tight">General Ledger & Accounting</h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Double-Entry Accounting System, Trial Balance, Frozen P&L, & Financial Adjustments
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => openAdjustmentModal("deposit")}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition-all"
          >
            <PlusCircle size={15} /> Customer Deposit
          </button>
          <button
            onClick={() => openAdjustmentModal("credit-note")}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-sky-600 hover:bg-sky-500 text-white transition-all"
          >
            <PlusCircle size={15} /> Credit Note
          </button>
          <button
            onClick={() => openAdjustmentModal("debit-note")}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-500 text-white transition-all"
          >
            <PlusCircle size={15} /> Debit Note
          </button>
          <button
            onClick={() => openAdjustmentModal("write-off")}
            className="flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white transition-all"
          >
            <AlertCircle size={15} /> Write-Off Bad Debt
          </button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-3 text-sm">
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-3 text-sm">
          <CheckCircle2 size={18} />
          {successMsg}
        </div>
      )}

      {/* Navigation Tabs & Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("trial-balance")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
              activeTab === "trial-balance"
                ? "bg-sky-600 text-white shadow-md shadow-sky-500/20"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <Scale size={16} /> Trial Balance
          </button>
          <button
            onClick={() => setActiveTab("profit-loss")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
              activeTab === "profit-loss"
                ? "bg-sky-600 text-white shadow-md shadow-sky-500/20"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <TrendingUp size={16} /> GL Profit & Loss
          </button>
          <button
            onClick={() => setActiveTab("journal-entries")}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all ${
              activeTab === "journal-entries"
                ? "bg-sky-600 text-white shadow-md shadow-sky-500/20"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <FileText size={16} /> Journal Audit Trail
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <Calendar size={14} className="text-slate-400" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 outline-none"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent text-slate-800 dark:text-slate-200 outline-none"
            />
          </div>
        </div>
      </div>

      {/* TAB 1: TRIAL BALANCE */}
      {activeTab === "trial-balance" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className={trialBalance?.isBalanced ? "text-emerald-500" : "text-rose-500"} size={20} />
              <span className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                General Ledger Status: {trialBalance?.isBalanced ? "BALANCED (Debits = Credits)" : "UNBALANCED DISCREPANCY"}
              </span>
            </div>
            <div className="text-xs text-slate-500">
              Total Debit: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{formatRs(trialBalance?.totalDebit)}</span> | Total Credit: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{formatRs(trialBalance?.totalCredit)}</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase">
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Account Name</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Total Debit</th>
                  <th className="py-3 px-4 text-right">Total Credit</th>
                  <th className="py-3 px-4 text-right">Net Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {(trialBalance?.accounts || []).map((acc) => (
                  <tr key={acc.code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-sky-600 dark:text-sky-400">{acc.code}</td>
                    <td className="py-3 px-4 font-medium">{acc.name}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {acc.type}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono">{formatRs(acc.totalDebit)}</td>
                    <td className="py-3 px-4 text-right font-mono">{formatRs(acc.totalCredit)}</td>
                    <td className={`py-3 px-4 text-right font-mono font-bold ${acc.netBalance >= 0 ? "text-slate-800 dark:text-slate-200" : "text-rose-500"}`}>
                      {formatRs(acc.netBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: GL PROFIT & LOSS */}
      {activeTab === "profit-loss" && profitAndLoss && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="text-emerald-500" size={20} /> Trading Account (Revenue & COGS)
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Gross Sales Revenue (GL 4000)</span>
                <span className="font-mono font-semibold">{formatRs(profitAndLoss.salesRevenue)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-rose-500">
                <span>Less: Sales Returns (GL 4100)</span>
                <span className="font-mono font-semibold">- {formatRs(profitAndLoss.salesReturns)}</span>
              </div>
              <div className="flex justify-between py-2 font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/40 px-3 rounded-lg">
                <span>Net Sales Revenue</span>
                <span className="font-mono">{formatRs(profitAndLoss.netSales)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-amber-600">
                <span>Less: Cost of Goods Sold (GL 5000)</span>
                <span className="font-mono font-semibold">- {formatRs(profitAndLoss.cogs)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800 text-sky-600">
                <span>Purchase Return Variance (GL 5100)</span>
                <span className="font-mono font-semibold">{formatRs(profitAndLoss.purchaseReturnVariance)}</span>
              </div>
              <div className="flex justify-between py-3 font-bold text-base text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-3 rounded-xl border border-emerald-200 dark:border-emerald-900">
                <span>Gross Profit</span>
                <span className="font-mono">{formatRs(profitAndLoss.grossProfit)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <DollarSign className="text-sky-500" size={20} /> Operating Account (Expenses & Net Profit)
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Operating Expenses (GL 6000)</span>
                <span className="font-mono font-semibold">{formatRs(profitAndLoss.operatingExpenses)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Bad Debt Expense (GL 6100)</span>
                <span className="font-mono font-semibold">{formatRs(profitAndLoss.badDebtExpense)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Inventory Shrinkage (GL 5200)</span>
                <span className="font-mono font-semibold">{formatRs(profitAndLoss.inventoryShrinkage)}</span>
              </div>
              <div className="flex justify-between py-2 font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800/40 px-3 rounded-lg">
                <span>Total Operating Expenses</span>
                <span className="font-mono">{formatRs(profitAndLoss.totalExpenses)}</span>
              </div>
              <div className={`flex justify-between py-3 font-bold text-lg px-3 rounded-xl border ${profitAndLoss.netProfit >= 0 ? "bg-sky-50 dark:bg-sky-950/30 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-900" : "bg-rose-50 dark:bg-rose-950/30 text-rose-600 border-rose-200"}`}>
                <span>Net Operating Profit</span>
                <span className="font-mono">{formatRs(profitAndLoss.netProfit)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: JOURNAL AUDIT TRAIL */}
      {activeTab === "journal-entries" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <Filter size={14} className="text-slate-400" />
              <select
                value={referenceTypeFilter}
                onChange={(e) => setReferenceTypeFilter(e.target.value)}
                className="bg-transparent text-slate-800 dark:text-slate-200 outline-none font-medium"
              >
                <option value="">All Document Types</option>
                <option value="INVOICE">Invoices</option>
                <option value="PURCHASE">Purchases</option>
                <option value="SALES_RETURN">Sales Returns</option>
                <option value="PURCHASE_RETURN">Purchase Returns</option>
                <option value="PAYMENT">Payments</option>
                <option value="CORRECTION">Credit/Debit Notes</option>
                <option value="DEPOSIT">Customer Deposits</option>
                <option value="WRITE_OFF">Bad Debt Write-Offs</option>
              </select>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">GL Account</th>
                  <th className="py-3 px-4">Ref Type</th>
                  <th className="py-3 px-4">Ref ID</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Debit</th>
                  <th className="py-3 px-4 text-right">Credit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {(journalEntries?.entries || []).map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 text-xs font-mono text-slate-500">
                      {new Date(entry.entryDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 font-medium">
                      <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400 mr-2">{entry.account?.code}</span>
                      {entry.account?.name}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        {entry.referenceType}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-slate-500">#{entry.referenceId}</td>
                    <td className="py-3 px-4 text-xs max-w-xs truncate text-slate-600 dark:text-slate-400">{entry.description}</td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100 font-medium">
                      {Number(entry.debit) > 0 ? formatRs(entry.debit) : "-"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 dark:text-slate-100 font-medium">
                      {Number(entry.credit) > 0 ? formatRs(entry.credit) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADJUSTMENT MODAL */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 capitalize">
              {modalType.replace("-", " ")}
            </h2>

            <form onSubmit={handleAdjustmentSubmit} className="space-y-4">
              {(modalType === "deposit" || modalType === "credit-note") && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Select Customer</label>
                  <select
                    required
                    value={formCustomerId}
                    onChange={(e) => setFormCustomerId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none"
                  >
                    <option value="">Choose Customer...</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} (Bal: Rs. {Number(c.balance).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {modalType === "debit-note" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Select Supplier</label>
                  <select
                    required
                    value={formSupplierId}
                    onChange={(e) => setFormSupplierId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none"
                  >
                    <option value="">Choose Supplier...</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} (Bal: Rs. {Number(s.balance).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {modalType === "write-off" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Select Unpaid Invoice</label>
                  <select
                    required
                    value={formInvoiceId}
                    onChange={(e) => setFormInvoiceId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none"
                  >
                    <option value="">Choose Invoice...</option>
                    {unpaidInvoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        Invoice #{inv.invoiceNo} (Due: Rs. {Number(inv.balanceDue).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {modalType !== "write-off" && (
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Amount (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="e.g. 5000.00"
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Reason / Description</label>
                <textarea
                  required
                  rows={3}
                  value={formReason}
                  onChange={(e) => setFormReason(e.target.value)}
                  placeholder="Provide accounting justification..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalType(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white rounded-xl transition-all shadow-md shadow-sky-500/20"
                >
                  {loading ? "Processing..." : "Confirm & Post"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
