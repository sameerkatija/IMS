import React, { useState, useEffect } from "react";
import api from "../services/api";
import { CreditCard, Plus, Calendar, Search, ArrowRightLeft, DollarSign } from "lucide-react";
import Toast from "../components/Toast";

const Payments = () => {
  const [activeTab, setActiveTab] = useState("customers");
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Data sources
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  // Tab 1: Customer Payments
  const [customerPayments, setCustomerPayments] = useState([]);
  const [isCustPaymentModalOpen, setIsCustPaymentModalOpen] = useState(false);
  const [custInvoices, setCustInvoices] = useState([]);
  const [custForm, setCustForm] = useState({
    customerId: "",
    invoiceId: "",
    amount: "",
    isCreditApplied: false,
    description: "",
    paymentDate: new Date().toISOString().substring(0, 10)
  });

  // Tab 2: Supplier Payments
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [isSuppPaymentModalOpen, setIsSuppPaymentModalOpen] = useState(false);
  const [suppPurchases, setSuppPurchases] = useState([]);
  const [suppForm, setSuppForm] = useState({
    supplierId: "",
    purchaseId: "",
    amount: "",
    isCreditApplied: false,
    description: "",
    paymentDate: new Date().toISOString().substring(0, 10)
  });

  const fetchCustomersAndSuppliers = async () => {
    try {
      const [custRes, suppRes] = await Promise.all([
        api.get("/api/customer?limit=100&isActive=true"),
        api.get("/api/supplier?limit=100&isActive=true")
      ]);
      if (custRes.data?.type === "success") setCustomers(custRes.data.data);
      if (suppRes.data?.type === "success") setSuppliers(suppRes.data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCustomerPayments = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/payment/customer");
      if (response.data) {
        setCustomerPayments(response.data.data || response.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSupplierPayments = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/payment/supplier");
      if (response.data) {
        setSupplierPayments(response.data.data || response.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomersAndSuppliers();
  }, []);

  useEffect(() => {
    if (activeTab === "customers") {
      fetchCustomerPayments();
    } else {
      fetchSupplierPayments();
    }
  }, [activeTab]);

  // Load customer invoices when customer is selected in modal
  const handleCustomerSelect = async (id) => {
    setCustForm({ ...custForm, customerId: id, invoiceId: "", isCreditApplied: false });
    if (!id) {
      setCustInvoices([]);
      return;
    }
    try {
      // Find customer unpaid or partially paid invoices
      const response = await api.get(`/api/invoice?customerId=${id}&limit=100`);
      if (response.data && response.data.type === "success") {
        // Filter for unpaid or partially paid invoices
        const outstanding = response.data.data.filter(inv => inv.status !== "PAID");
        setCustInvoices(outstanding);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCustPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!custForm.customerId || !custForm.amount || Number(custForm.amount) <= 0) {
      setToast({ message: "Please enter valid fields.", type: "error" });
      return;
    }

    const selectedCust = customers.find(c => c.id === Number(custForm.customerId));
    const outstandingBal = selectedCust ? Number(selectedCust.balance) : 0;
    
    if (custForm.isCreditApplied) {
      if (!custForm.invoiceId) {
        setToast({ message: "An invoice is required when applying credit.", type: "error" });
        return;
      }

      const totalInvoiceOutstanding = custInvoices.reduce((sum, inv) => sum + Number(inv.balanceDue), 0);
      const availableCredit = Math.max(0, totalInvoiceOutstanding - outstandingBal);

      if (Number(custForm.amount) > availableCredit) {
        setToast({
          message: `Blocked! Amount (Rs.${custForm.amount}) exceeds available store credit (Rs.${availableCredit.toFixed(2)}).`,
          type: "error"
        });
        return;
      }
    } else {
      // Validate that payment does not exceed customer's outstanding balance
      if (Number(custForm.amount) > outstandingBal) {
        setToast({ 
          message: `Overpayment blocked! Amount (Rs.${custForm.amount}) exceeds outstanding balance (Rs.${outstandingBal.toFixed(2)}).`, 
          type: "error" 
        });
        return;
      }
    }

    // If paying against invoice, validate invoice amount
    if (custForm.invoiceId) {
      const selectedInv = custInvoices.find(i => i.id === Number(custForm.invoiceId));
      if (selectedInv) {
        const invDue = Number(selectedInv.balanceDue);
        if (Number(custForm.amount) > invDue) {
          setToast({
            message: `Overpayment blocked! Amount exceeds invoice balance due of Rs.${invDue.toFixed(2)}.`,
            type: "error"
          });
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        customerId: Number(custForm.customerId),
        invoiceId: custForm.invoiceId ? Number(custForm.invoiceId) : null,
        amount: Number(custForm.amount),
        isCreditApplied: custForm.isCreditApplied,
        description: custForm.description || null,
        paymentDate: custForm.paymentDate ? new Date(custForm.paymentDate).toISOString() : undefined
      };

      const response = await api.post("/api/payment/customer", payload);
      if (response.data) {
        setToast({ message: custForm.isCreditApplied ? "Customer store credit applied successfully." : "Customer payment registered successfully.", type: "success" });
        fetchCustomerPayments();
        fetchCustomersAndSuppliers(); // sync balances
        setIsCustPaymentModalOpen(false);
        setCustForm({ customerId: "", invoiceId: "", amount: "", isCreditApplied: false, description: "", paymentDate: new Date().toISOString().substring(0, 10) });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to process customer payment.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Load supplier purchases when supplier is selected
  const handleSupplierSelect = async (id) => {
    setSuppForm({ ...suppForm, supplierId: id, purchaseId: "", isCreditApplied: false });
    if (!id) {
      setSuppPurchases([]);
      return;
    }
    try {
      const response = await api.get(`/api/purchase?supplierId=${id}&limit=100`);
      if (response.data && response.data.type === "success") {
        const outstanding = response.data.data.filter(p => p.status !== "PAID");
        setSuppPurchases(outstanding);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSuppPaymentSubmit = async (e) => {
    e.preventDefault();
    if (!suppForm.supplierId || !suppForm.amount || Number(suppForm.amount) <= 0) {
      setToast({ message: "Please fill all required fields correctly.", type: "error" });
      return;
    }

    const selectedSupp = suppliers.find(s => s.id === Number(suppForm.supplierId));
    const outstandingOwed = selectedSupp ? Number(selectedSupp.balance) : 0;
    const availableCredit = selectedSupp && selectedSupp.balance < 0 ? Math.abs(Number(selectedSupp.balance)) : 0;

    if (suppForm.isCreditApplied) {
      if (!suppForm.purchaseId) {
        setToast({ message: "Purchase is required when applying credit.", type: "error" });
        return;
      }
      if (Number(suppForm.amount) > availableCredit) {
        setToast({
          message: `Overpayment blocked! Amount exceeds available supplier credit of Rs.${availableCredit.toFixed(2)}.`,
          type: "error"
        });
        return;
      }
    } else {
      if (Number(suppForm.amount) > outstandingOwed) {
        setToast({
          message: `Overpayment blocked! Payment exceeds outstanding balance owed of Rs.${outstandingOwed.toFixed(2)}.`,
          type: "error"
        });
        return;
      }
    }

    // If paying against purchase, validate purchase balance due
    if (suppForm.purchaseId) {
      const selectedPur = suppPurchases.find(p => p.id === Number(suppForm.purchaseId));
      if (selectedPur) {
        const purDue = Number(selectedPur.balanceDue);
        if (Number(suppForm.amount) > purDue) {
          setToast({
            message: `Overpayment blocked! Amount exceeds purchase balance due of Rs.${purDue.toFixed(2)}.`,
            type: "error"
          });
          return;
        }
      }
    }

    try {
      setSubmitting(true);
      const payload = {
        supplierId: Number(suppForm.supplierId),
        purchaseId: suppForm.purchaseId ? Number(suppForm.purchaseId) : null,
        amount: Number(suppForm.amount),
        isCreditApplied: suppForm.isCreditApplied,
        description: suppForm.description || null,
        paymentDate: suppForm.paymentDate ? new Date(suppForm.paymentDate).toISOString() : undefined
      };

      const response = await api.post("/api/payment/supplier", payload);
      if (response.data) {
        setToast({ message: suppForm.isCreditApplied ? "Supplier credit applied successfully." : "Supplier payment registered successfully.", type: "success" });
        fetchSupplierPayments();
        fetchCustomersAndSuppliers(); // sync balances
        setIsSuppPaymentModalOpen(false);
        setSuppForm({ supplierId: "", purchaseId: "", amount: "", isCreditApplied: false, description: "", paymentDate: new Date().toISOString().substring(0, 10) });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to process supplier payment.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Tabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-8 text-sm font-medium">
          <button
            onClick={() => setActiveTab("customers")}
            className={`py-4 border-b-2 px-1 transition-all ${
              activeTab === "customers"
                ? "border-sky-600 text-sky-600 dark:text-sky-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Customer Payouts (Collections)
          </button>
          <button
            onClick={() => setActiveTab("suppliers")}
            className={`py-4 border-b-2 px-1 transition-all ${
              activeTab === "suppliers"
                ? "border-sky-600 text-sky-600 dark:text-sky-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Supplier Payouts (Settlements)
          </button>
        </nav>
      </div>

      {activeTab === "customers" ? (
        /* CUSTOMER PAYMENTS SHEET */
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Customer Payout collections</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Log cash payments received from credit accounts. Deducts customer outstanding balance.
              </p>
            </div>
            <button
              onClick={() => setIsCustPaymentModalOpen(true)}
              className="inline-flex items-center justify-center px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 active:scale-95 transition-all duration-150"
            >
              <Plus size={16} className="mr-2" /> Log Customer Payment
            </button>
          </div>

          {loading && customerPayments.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : customerPayments.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <CreditCard className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={40} />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No customer payments</h3>
              <p className="text-sm text-slate-400 mt-1">Payments recorded against outstanding credit will log here.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="px-6 py-4">Payment ID</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Invoice Reference</th>
                      <th className="px-6 py-4">Description</th>
                      <th className="px-6 py-4 text-right">Amount (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {customerPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                        <td className="px-6 py-4 font-mono text-xs text-slate-400">
                          #{p.id}
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                          {new Date(p.paymentDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-950 dark:text-white capitalize">
                          {p.customer?.name}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {p.invoice?.invoiceNo || <span className="italic text-slate-450">General Balance Payment</span>}
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs">
                          {p.description || <span className="italic text-slate-400">No notes</span>}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-emerald-600 dark:text-emerald-450">
                          Rs. {Number(p.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Customer Payment Modal */}
          {isCustPaymentModalOpen && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Record Customer Collection
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Apply payment against outstanding general balance or target a specific invoice.
                  </p>
                </div>

                <form onSubmit={handleCustPaymentSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Customer Account *</label>
                    <select
                      required
                      value={custForm.customerId}
                      onChange={(e) => handleCustomerSelect(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                    >
                      <option value="">Select Customer...</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (Balance: Rs.{Number(c.balance).toFixed(0)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {custForm.customerId && (() => {
                    const selectedCust = customers.find(c => c.id === Number(custForm.customerId));
                    const outstandingBal = selectedCust ? Number(selectedCust.balance) : 0;
                    const totalInvoiceOutstanding = custInvoices.reduce((sum, inv) => sum + Number(inv.balanceDue), 0);
                    const availableCredit = Math.max(0, totalInvoiceOutstanding - outstandingBal);

                    return (
                      <>
                        {availableCredit > 0 && (
                          <div>
                            <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Payment Method</label>
                            <select
                              value={custForm.isCreditApplied ? "CREDIT" : "CASH"}
                              onChange={(e) => setCustForm({
                                ...custForm,
                                isCreditApplied: e.target.value === "CREDIT",
                                invoiceId: e.target.value === "CREDIT" ? (custInvoices[0]?.id?.toString() || "") : ""
                              })}
                              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm font-semibold"
                            >
                              <option value="CASH">Cash Collection (Standard)</option>
                              <option value="CREDIT">Apply Store Credit (Available: Rs. {availableCredit.toFixed(0)})</option>
                            </select>
                          </div>
                        )}

                        <div>
                          <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">
                            Link to Outstanding Invoice {custForm.isCreditApplied ? "*" : "(Optional)"}
                          </label>
                          <select
                            required={custForm.isCreditApplied}
                            value={custForm.invoiceId}
                            onChange={(e) => setCustForm({ ...custForm, invoiceId: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm font-mono"
                          >
                            {!custForm.isCreditApplied && <option value="">No link - Apply to overall account balance</option>}
                            {custInvoices.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.invoiceNo} (Due: Rs. {Number(inv.balanceDue).toFixed(0)})
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Amount (PKR) *</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="1"
                        value={custForm.amount}
                        onChange={(e) => setCustForm({ ...custForm, amount: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm font-semibold"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Date</label>
                      <input
                        type="date"
                        required
                        value={custForm.paymentDate}
                        onChange={(e) => setCustForm({ ...custForm, paymentDate: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Description / Receipt Notes</label>
                    <input
                      type="text"
                      value={custForm.description}
                      onChange={(e) => setCustForm({ ...custForm, description: e.target.value })}
                      placeholder="e.g. Received cash at counter"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                    />
                  </div>

                  <div className="flex space-x-3 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setIsCustPaymentModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md shadow-sky-500/20 disabled:bg-sky-850 transition-colors"
                    >
                      {submitting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      ) : (
                        <DollarSign size={14} className="mr-2" />
                      )}
                      Commit Payment
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* SUPPLIER PAYMENTS SHEET */
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Supplier Payout Settlements</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Log cash payments sent to suppliers. Deducts overall outstanding accounts payables.
              </p>
            </div>
            <button
              onClick={() => setIsSuppPaymentModalOpen(true)}
              className="inline-flex items-center justify-center px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 active:scale-95 transition-all duration-150"
            >
              <Plus size={16} className="mr-2" /> Log Supplier Settlement
            </button>
          </div>

          {loading && supplierPayments.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : supplierPayments.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <CreditCard className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={40} />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No supplier payments</h3>
              <p className="text-sm text-slate-400 mt-1">Settlements paid to suppliers will register here.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="px-6 py-4">Payment ID</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Supplier</th>
                      <th className="px-6 py-4">Purchase Reference</th>
                      <th className="px-6 py-4">Description</th>
                      <th className="px-6 py-4 text-right">Amount (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {supplierPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                        <td className="px-6 py-4 font-mono text-xs text-slate-400">
                          #{p.id}
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                          {new Date(p.paymentDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-950 dark:text-white capitalize">
                          {p.supplier?.name}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">
                          {p.purchase?.purchaseNo || <span className="italic text-slate-400">General Balance Payout</span>}
                        </td>
                        <td className="px-6 py-4 text-slate-500 text-xs">
                          {p.description || <span className="italic text-slate-400">No notes</span>}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-rose-600 dark:text-rose-450">
                          Rs. {Number(p.amount).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Supplier Payment Modal */}
          {isSuppPaymentModalOpen && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Record Supplier Settlement
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Apply payment against outstanding balance to reduce accounts payable.
                  </p>
                </div>

                <form onSubmit={handleSuppPaymentSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Supplier *</label>
                    <select
                      required
                      value={suppForm.supplierId}
                      onChange={(e) => handleSupplierSelect(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                    >
                      <option value="">Select Supplier...</option>
                      {suppliers.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} (Owed: Rs.{Number(s.balance).toFixed(0)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {(() => {
                    const selectedSupplier = suppliers.find(s => s.id === Number(suppForm.supplierId));
                    const totalInvoiceOutstanding = suppPurchases.reduce((sum, p) => sum + Number(p.balanceDue), 0);
                    const supplierBalance = selectedSupplier ? Number(selectedSupplier.balance) : 0;
                    const availableCredit = Math.max(0, totalInvoiceOutstanding - supplierBalance);
                    return suppForm.supplierId && (
                      <>
                        <div>
                          <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Payment Method</label>
                          <select
                            value={suppForm.isCreditApplied ? "credit" : "cash"}
                            onChange={(e) => {
                              const isCredit = e.target.value === "credit";
                              setSuppForm({ ...suppForm, isCreditApplied: isCredit, purchaseId: "" });
                            }}
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm font-semibold"
                          >
                            <option value="cash">Cash / Bank Payment</option>
                            <option value="credit" disabled={availableCredit <= 0}>
                              Apply Supplier Credit {availableCredit > 0 ? `(Rs. ${availableCredit.toFixed(0)} available)` : "(No credit available)"}
                            </option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">
                            {suppForm.isCreditApplied ? "Link to Inbound Purchase *" : "Link to Inbound Purchase (Optional)"}
                          </label>
                          <select
                            required={suppForm.isCreditApplied}
                            value={suppForm.purchaseId}
                            onChange={(e) => setSuppForm({ ...suppForm, purchaseId: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm font-mono"
                          >
                            {!suppForm.isCreditApplied && <option value="">No link - Apply to overall account balance owed</option>}
                            {suppForm.isCreditApplied && <option value="">Select a purchase to apply credit...</option>}
                            {suppPurchases.map((pur) => (
                              <option key={pur.id} value={pur.id}>
                                {pur.purchaseNo} (Due: Rs. {Number(pur.balanceDue).toFixed(0)})
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Amount (PKR) *</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="1"
                        value={suppForm.amount}
                        onChange={(e) => setSuppForm({ ...suppForm, amount: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm font-semibold"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Date</label>
                      <input
                        type="date"
                        required
                        value={suppForm.paymentDate}
                        onChange={(e) => setSuppForm({ ...suppForm, paymentDate: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Description / Receipt Notes</label>
                    <input
                      type="text"
                      value={suppForm.description}
                      onChange={(e) => setSuppForm({ ...suppForm, description: e.target.value })}
                      placeholder="e.g. Cleared via bank transfer"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                    />
                  </div>

                  <div className="flex space-x-3 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setIsSuppPaymentModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md shadow-sky-500/20 disabled:bg-sky-850 transition-colors"
                    >
                      {submitting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      ) : (
                        <DollarSign size={14} className="mr-2" />
                      )}
                      Commit Settlement
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Payments;
