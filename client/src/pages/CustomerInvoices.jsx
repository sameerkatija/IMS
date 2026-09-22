import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../services/api";
import {
  Receipt,
  FileText,
  Search,
  Eye,
  Printer,
  ArrowLeft,
  Calendar,
  Phone,
  MapPin,
  TrendingUp,
  CreditCard,
  AlertCircle,
  CheckCircle2,
  Clock
} from "lucide-react";
import Toast from "../components/Toast";
import InvoiceDetailModal from "../components/InvoiceDetailModal";
import { formatCurrency, formatCurrencyNoDecimals } from "../utils/format";

const CustomerInvoices = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const customerIdParam = searchParams.get("customerId") || "";
  const [selectedCustomerId, setSelectedCustomerId] = useState(customerIdParam);

  const [customers, setCustomers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [docStatusFilter, setDocStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  // Invoice Detail Modal State
  const [viewInvoiceId, setViewInvoiceId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch all customers for customer switcher dropdown
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await api.get("/api/customer?limit=all&sortBy=name");
        if (res.data?.type === "success") {
          const list = res.data.data || [];
          setCustomers(list);
          // If no customerId in query, default to first customer if available
          if (!selectedCustomerId && list.length > 0) {
            setSelectedCustomerId(String(list[0].id));
            setSearchParams({ customerId: String(list[0].id) });
          }
        }
      } catch (err) {
        console.error("Error fetching customers list:", err);
      }
    };
    fetchCustomers();
  }, []);

  // Synchronize when customerIdParam in URL changes
  useEffect(() => {
    if (customerIdParam && customerIdParam !== selectedCustomerId) {
      setSelectedCustomerId(customerIdParam);
    }
  }, [customerIdParam]);

  // Fetch invoices for currently selected customer
  const fetchCustomerInvoices = async () => {
    if (!selectedCustomerId) {
      setInvoices([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      let query = `?customerId=${selectedCustomerId}&limit=all`;
      if (searchQuery.trim()) query += `&search=${encodeURIComponent(searchQuery.trim())}`;
      if (statusFilter !== "all") query += `&status=${statusFilter}`;
      if (docStatusFilter !== "all") query += `&documentStatus=${docStatusFilter}`;
      if (fromDate) query += `&from=${fromDate}`;
      if (toDate) query += `&to=${toDate}`;

      const res = await api.get(`/api/invoice${query}`);
      if (res.data?.type === "success") {
        setInvoices(res.data.data || []);
      }
    } catch (err) {
      console.error("Error fetching customer invoices:", err);
      setToast({ message: "Failed to load customer invoices.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomerInvoices();
  }, [selectedCustomerId, searchQuery, statusFilter, docStatusFilter, fromDate, toDate]);

  const handleCustomerChange = (id) => {
    setSelectedCustomerId(id);
    setSearchParams({ customerId: id });
  };

  const openInvoiceDetail = (invoiceId) => {
    setViewInvoiceId(invoiceId);
    setIsModalOpen(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const currentCustomer = customers.find((c) => c.id === Number(selectedCustomerId));

  // Compute summary stats for this customer's loaded invoices
  const totalInvoicesCount = invoices.length;
  const totalBilled = invoices.reduce((sum, inv) => sum + Number(inv.total || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + Number(inv.paidAmount || 0), 0);
  const totalBalanceDue = invoices.reduce((sum, inv) => {
    const returnsAmt = (inv.salesReturns || []).reduce((rSum, r) => rSum + Number(r.totalAmount || 0), 0);
    const balance = Math.max(
      0,
      Number(inv.total) -
        Number(inv.transportDiscount || 0) -
        Number(inv.paidAmount || 0) -
        Number(inv.creditApplied || 0) -
        returnsAmt
    );
    return sum + balance;
  }, 0);

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Detail & Print Modal */}
      <InvoiceDetailModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setViewInvoiceId(null);
        }}
        invoiceId={viewInvoiceId}
      />

      {/* Top Navigation & Controls Bar (No Print) */}
      <div className="space-y-4 no-print">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 dark:border-slate-800 pb-4 gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/customers")}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
            >
              <ArrowLeft className="mr-1.5" size={14} /> Back to Customers
            </button>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center">
              <Receipt className="mr-2 text-emerald-600 dark:text-emerald-400" size={20} /> Customer Invoices
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Quick Customer Switcher */}
            <select
              value={selectedCustomerId}
              onChange={(e) => handleCustomerChange(e.target.value)}
              className="px-3 py-1.5 text-xs font-semibold border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 rounded-xl outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.id} - {c.name}
                </option>
              ))}
            </select>

            {/* Direct Link to Ledger Statement */}
            <button
              onClick={() => navigate(`/reports?tab=customer-ledger&customerId=${selectedCustomerId}`)}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 rounded-xl border border-sky-200 dark:border-sky-900/40 hover:bg-sky-100 transition-colors"
              title="View Ledger Statement"
            >
              <FileText size={13} className="mr-1.5" /> View Ledger Sheet
            </button>

            {/* Print Invoices Sheet */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 rounded-xl border border-emerald-200 dark:border-emerald-900/40 hover:bg-emerald-100 transition-colors"
            >
              <Printer size={13} className="mr-1.5" /> Print Sheet
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center">
          <div className="w-full md:w-64 flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
            <Search className="text-slate-400 mr-2 flex-shrink-0" size={16} />
            <input
              type="text"
              placeholder="Search Invoice No (INV-...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs bg-transparent outline-none border-none focus:ring-0 placeholder-slate-400"
            />
          </div>

          <div className="w-full md:w-44 flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full text-xs bg-transparent border-none outline-none focus:ring-0 text-slate-700 dark:text-slate-300 font-medium"
            >
              <option value="all">All Payment Status</option>
              <option value="PAID">Paid</option>
              <option value="PARTIALLY_PAID">Partially Paid</option>
              <option value="UNPAID">Unpaid</option>
            </select>
          </div>

          <div className="w-full md:w-44 flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
            <select
              value={docStatusFilter}
              onChange={(e) => setDocStatusFilter(e.target.value)}
              className="w-full text-xs bg-transparent border-none outline-none focus:ring-0 text-slate-700 dark:text-slate-300 font-medium"
            >
              <option value="all">All Documents</option>
              <option value="POSTED">Confirmed Only</option>
              <option value="DRAFT">Drafts Only</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-500">
            <Calendar size={14} className="text-slate-400 shrink-0" />
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="bg-transparent border-none outline-none text-xs text-slate-700 dark:text-slate-300"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="bg-transparent border-none outline-none text-xs text-slate-700 dark:text-slate-300"
            />
          </div>

          {(searchQuery || statusFilter !== "all" || docStatusFilter !== "all" || fromDate || toDate) && (
            <button
              onClick={() => {
                setSearchQuery("");
                setStatusFilter("all");
                setDocStatusFilter("all");
                setFromDate("");
                setToDate("");
              }}
              className="text-xs text-rose-500 hover:text-rose-600 font-medium px-2 py-1"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Main Printable / Viewable Sheet Container ("Like the ledger") */}
      <div className="print-area bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6 print:border-none print:shadow-none">
        {/* Document Header */}
        <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">Sameer Distributors</h1>
            <p className="text-xs text-slate-500 mt-1">Chronological Sales Invoices Statement</p>
          </div>
          <div className="text-right">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase">Customer Invoices Sheet</h2>
            <p className="text-xs text-slate-500 mt-0.5">Date: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Account Profile Card */}
        <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Account Profile</p>
            <p className="font-bold text-base text-slate-950 dark:text-white mt-0.5 capitalize">
              {currentCustomer?.name || "Customer Account"}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-1">
              <span className="flex items-center">
                <Phone size={12} className="mr-1 text-slate-400" />
                {currentCustomer?.phone || "No phone registered"}
              </span>
              <span className="flex items-center">
                <MapPin size={12} className="mr-1 text-slate-400" />
                {currentCustomer?.address || "No address registered"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold ${
                currentCustomer?.isActive
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {currentCustomer?.isActive ? "Active Account" : "Inactive"}
            </span>
          </div>
        </div>

        {/* Summary Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 no-print">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Invoices</span>
            <span className="text-lg font-black text-slate-900 dark:text-white mt-1 block">
              {totalInvoicesCount}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Invoiced</span>
            <span className="text-lg font-black text-slate-900 dark:text-white mt-1 block">
              Rs. {formatCurrencyNoDecimals(totalBilled)}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">
              Amount Paid
            </span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-1 block">
              Rs. {formatCurrencyNoDecimals(totalPaid)}
            </span>
          </div>

          <div className="p-3.5 bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 rounded-xl">
            <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 block">
              Remaining Balance
            </span>
            <span className="text-lg font-black text-rose-600 dark:text-rose-400 mt-1 block">
              Rs. {formatCurrencyNoDecimals(totalBalanceDue)}
            </span>
          </div>
        </div>

        {/* Invoices List Table */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs">Loading customer invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-16 bg-slate-50 dark:bg-slate-950/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
            <Receipt className="mx-auto text-slate-300 dark:text-slate-700 mb-2" size={36} />
            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">No Invoices Found</h4>
            <p className="text-xs text-slate-400 mt-1">
              No sales invoices match the selected criteria for this customer account.
            </p>
          </div>
        ) : (
          <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                    <th className="px-4 py-3">Timestamp / Date</th>
                    <th className="px-4 py-3">Invoice No</th>
                    <th className="px-4 py-3">Booker / Salesman</th>
                    <th className="px-4 py-3 text-center">Type</th>
                    <th className="px-4 py-3 text-right">Items</th>
                    <th className="px-4 py-3 text-right font-bold">Total Amount</th>
                    <th className="px-4 py-3 text-right">Paid Amount</th>
                    <th className="px-4 py-3 text-right font-bold">Balance Due</th>
                    <th className="px-4 py-3 text-center">Payment Status</th>
                    <th className="px-4 py-3 text-right no-print">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invoices.map((inv) => {
                    const totalReturns = (inv.salesReturns || []).reduce(
                      (sum, ret) => sum + Number(ret.totalAmount || 0),
                      0
                    );
                    const calculatedBalance = Math.max(
                      0,
                      Number(inv.total) -
                        Number(inv.transportDiscount || 0) -
                        Number(inv.paidAmount || 0) -
                        Number(inv.creditApplied || 0) -
                        totalReturns
                    );

                    return (
                      <tr
                        key={inv.id}
                        onClick={() => openInvoiceDetail(inv.id)}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                        title="Click to view full invoice"
                      >
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                          {new Date(inv.invoiceDate).toLocaleDateString()}
                          <span className="text-[10px] text-slate-400 block">
                            {new Date(inv.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>

                        <td className="px-4 py-3 font-mono font-bold text-sky-600 dark:text-sky-400 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span>{inv.invoiceNo}</span>
                            {inv.documentStatus === "DRAFT" && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                                DRAFT
                              </span>
                            )}
                            {inv.salesReturns && inv.salesReturns.length > 0 && (
                              <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                                RET
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3 capitalize text-slate-600 dark:text-slate-300">
                          {inv.salesman?.name || <span className="text-slate-400 italic">Counter</span>}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              inv.saleType === "CREDIT"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-900/40"
                                : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
                            }`}
                          >
                            {inv.saleType}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right font-mono font-medium text-slate-600 dark:text-slate-300">
                          {inv.items?.reduce((sum, item) => sum + Number(item.quantity || 0), 0) || 0} pcs
                        </td>

                        <td className="px-4 py-3 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                          Rs. {formatCurrency(inv.total)}
                        </td>

                        <td className="px-4 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          Rs. {formatCurrency(inv.paidAmount)}
                        </td>

                        <td className="px-4 py-3 text-right font-bold whitespace-nowrap">
                          <span
                            className={
                              calculatedBalance > 0
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-slate-400 font-normal"
                            }
                          >
                            Rs. {formatCurrency(calculatedBalance)}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                              inv.status === "PAID"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40"
                                : inv.status === "PARTIALLY_PAID"
                                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/40"
                                : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/40"
                            }`}
                          >
                            {inv.status.replace("_", " ")}
                          </span>
                        </td>

                        <td
                          className="px-4 py-3 text-right no-print"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => openInvoiceDetail(inv.id)}
                            className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-lg border border-sky-200 dark:border-sky-900/40 transition-colors"
                          >
                            <Eye size={12} className="mr-1" /> View
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerInvoices;
