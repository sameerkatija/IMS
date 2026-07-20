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
  const [allocations, setAllocations] = useState({}); // { [invoiceId]: amount }
  const [custForm, setCustForm] = useState({
    customerId: "",
    invoiceId: "",
    amount: "",
    isCreditApplied: false,
    description: "",
    paymentDate: new Date().toISOString().substring(0, 10)
  });

  // Post-Creation Allocation Modal state
  const [isAllocateModalOpen, setIsAllocateModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [paymentInvoices, setPaymentInvoices] = useState([]);
  const [postAllocations, setPostAllocations] = useState({}); // { [invoiceId]: amount }

  // Live customer balance (re-fetched when customer selected in modal, avoids stale list)
  const [freshCustomerBalance, setFreshCustomerBalance] = useState(null);

  // Refund Customer Credit Modal state
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [freshRefundBalance, setFreshRefundBalance] = useState(null);
  const [refundForm, setRefundForm] = useState({
    customerId: "",
    amount: "",
    description: "",
    refundDate: new Date().toISOString().substring(0, 10)
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


  // Load customer invoices + fresh balance when customer is selected in modal
  const handleCustomerSelect = async (id) => {
    setCustForm({ ...custForm, customerId: id, invoiceId: "", isCreditApplied: false, amount: "" });
    setAllocations({});
    setFreshCustomerBalance(null);
    if (!id) {
      setCustInvoices([]);
      return;
    }
    try {
      // Fetch fresh customer balance and outstanding invoices in parallel to avoid stale data
      const [custRes, invRes] = await Promise.all([
        api.get(`/api/customer/${id}`),
        api.get(`/api/invoice?customerId=${id}&limit=100`)
      ]);
      if (custRes.data) {
        const cust = custRes.data.data || custRes.data;
        setFreshCustomerBalance(Number(cust.balance ?? 0));
      }
      if (invRes.data && invRes.data.type === "success") {
        const outstanding = invRes.data.data.filter(inv => inv.status !== "PAID");
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

    // Use freshly-fetched balance if available; fall back to the stale list only as a last resort
    const liveBalance = freshCustomerBalance !== null
      ? freshCustomerBalance
      : Number(customers.find(c => c.id === Number(custForm.customerId))?.balance || 0);

    if (custForm.isCreditApplied) {
      if (!custForm.invoiceId) {
        setToast({ message: "An invoice is required when applying credit.", type: "error" });
        return;
      }
      const availableCredit = liveBalance < 0 ? Math.abs(liveBalance) : 0;
      const selectedInv = custInvoices.find(inv => inv.id === Number(custForm.invoiceId));
      const maxApplicable = selectedInv ? Math.min(availableCredit, Number(selectedInv.balanceDue)) : availableCredit;

      if (Number(custForm.amount) > maxApplicable) {
        setToast({
          message: `Blocked! Amount (Rs.${custForm.amount}) exceeds applicable credit (Rs.${maxApplicable.toFixed(2)}) for the selected invoice.`,
          type: "error"
        });
        return;
      }
    } else {
      // General customer cash collection - allowed to exceed current balance (prepayment)
    }


    const allocationArray = Object.entries(allocations)
      .filter(([_, val]) => Number(val) > 0)
      .map(([invId, val]) => ({ invoiceId: Number(invId), amountAllocated: Number(val) }));

    const totalAllocated = allocationArray.reduce((sum, a) => sum + a.amountAllocated, 0);
    if (totalAllocated > Number(custForm.amount)) {
      setToast({ message: `Total allocations (Rs. ${totalAllocated}) cannot exceed payment amount (Rs. ${custForm.amount}).`, type: "error" });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        customerId: Number(custForm.customerId),
        amount: Number(custForm.amount),
        isCreditApplied: custForm.isCreditApplied,
        description: custForm.description || null,
        paymentDate: custForm.paymentDate ? new Date(custForm.paymentDate).toISOString() : undefined,
        allocations: custForm.isCreditApplied
          ? [{ invoiceId: Number(custForm.invoiceId), amountAllocated: Number(custForm.amount) }]
          : allocationArray
      };

      const response = await api.post("/api/payment/customer", payload);
      if (response.data) {
        setToast({ message: custForm.isCreditApplied ? "Customer store credit applied successfully." : "Customer payment registered successfully.", type: "success" });
        fetchCustomerPayments();
        fetchCustomersAndSuppliers(); // sync balances
        setIsCustPaymentModalOpen(false);
        setCustForm({ customerId: "", invoiceId: "", amount: "", isCreditApplied: false, description: "", paymentDate: new Date().toISOString().substring(0, 10) });
        setAllocations({});
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to process customer payment.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRefundCustomerSelect = async (id) => {
    setRefundForm({ ...refundForm, customerId: id, amount: "" });
    setFreshRefundBalance(null);
    if (!id) return;
    try {
      const response = await api.get(`/api/customer/${id}`);
      if (response.data) {
        const cust = response.data.data || response.data;
        setFreshRefundBalance(Number(cust.balance ?? 0));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRefundSubmit = async (e) => {
    e.preventDefault();
    if (!refundForm.customerId || !refundForm.amount || Number(refundForm.amount) <= 0) {
      setToast({ message: "Please fill all required fields correctly.", type: "error" });
      return;
    }

    const liveBalance = freshRefundBalance !== null
      ? freshRefundBalance
      : Number(customers.find(c => c.id === Number(refundForm.customerId))?.balance || 0);

    if (liveBalance >= 0) {
      setToast({ message: "Customer has no credit balance to refund.", type: "error" });
      return;
    }

    const availableCredit = Math.abs(liveBalance);
    if (Number(refundForm.amount) > availableCredit) {
      setToast({
        message: `Refund amount (Rs. ${refundForm.amount}) exceeds available credit (Rs. ${availableCredit.toFixed(2)}).`,
        type: "error"
      });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        customerId: Number(refundForm.customerId),
        amount: Number(refundForm.amount),
        description: refundForm.description || null,
        refundDate: refundForm.refundDate ? new Date(refundForm.refundDate).toISOString() : undefined
      };

      const response = await api.post("/api/payment/customer/refund-credit", payload);
      if (response.data) {
        setToast({ message: "Store credit refunded successfully as cash.", type: "success" });
        fetchCustomerPayments();
        fetchCustomersAndSuppliers();
        setIsRefundModalOpen(false);
        setRefundForm({ customerId: "", amount: "", description: "", refundDate: new Date().toISOString().substring(0, 10) });
        setFreshRefundBalance(null);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to process customer refund.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };


  const handleOpenAllocateModal = async (payment, remaining) => {
    setSelectedPayment({ ...payment, remainingUnallocated: remaining });
    setPostAllocations({});
    try {
      const response = await api.get(`/api/invoice?customerId=${payment.customerId}&limit=100`);
      if (response.data && response.data.type === "success") {
        const outstanding = response.data.data.filter(inv => inv.status !== "PAID");
        setPaymentInvoices(outstanding);
        setIsAllocateModalOpen(true);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load customer outstanding invoices.", type: "error" });
    }
  };

  const handlePostAllocationSubmit = async (e) => {
    e.preventDefault();
    const allocationArray = Object.entries(postAllocations)
      .filter(([_, val]) => Number(val) > 0)
      .map(([invId, val]) => ({ invoiceId: Number(invId), amountAllocated: Number(val) }));

    if (allocationArray.length === 0) {
      setToast({ message: "Please specify at least one allocation amount.", type: "error" });
      return;
    }

    const totalAllocated = allocationArray.reduce((sum, a) => sum + a.amountAllocated, 0);
    if (totalAllocated > selectedPayment.remainingUnallocated) {
      setToast({ message: `Total allocations (Rs. ${totalAllocated}) cannot exceed available amount (Rs. ${selectedPayment.remainingUnallocated.toFixed(2)}).`, type: "error" });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        customerPaymentId: selectedPayment.id,
        allocations: allocationArray
      };
      const response = await api.post("/api/payment/customer/allocate", payload);
      if (response.data) {
        setToast({ message: "Payment allocations committed successfully.", type: "success" });
        fetchCustomerPayments();
        fetchCustomersAndSuppliers();
        setIsAllocateModalOpen(false);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to save allocations.", type: "error" });
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
      // General supplier cash payment - allowed to exceed current balance (prepayment)
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
            <div className="flex space-x-3">
              <button
                onClick={() => setIsRefundModalOpen(true)}
                className="inline-flex items-center justify-center px-4 py-2 bg-rose-600 hover:bg-rose-505 text-white text-sm font-semibold rounded-xl shadow-md shadow-rose-500/20 active:scale-95 transition-all duration-150"
              >
                <ArrowRightLeft size={16} className="mr-2" /> Refund Store Credit
              </button>
              <button
                onClick={() => setIsCustPaymentModalOpen(true)}
                className="inline-flex items-center justify-center px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 active:scale-95 transition-all duration-150"
              >
                <Plus size={16} className="mr-2" /> Log Customer Payment
              </button>
            </div>
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
                      <th className="px-6 py-4">Type</th>
                      <th className="px-6 py-4">Invoice Reference</th>
                      <th className="px-6 py-4">Description</th>
                      <th className="px-6 py-4 text-right">Amount (PKR)</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {customerPayments.map((p) => {
                      const paymentTypeMeta = {
                        CASH: { label: "Cash", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
                        CREDIT_APPLICATION: { label: "Credit Applied", cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400" },
                        CASH_REFUND: { label: "Refund", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400" },
                      };
                      const typeInfo = paymentTypeMeta[p.paymentType] || paymentTypeMeta.CASH;
                      const allocatedTotal = p.allocations?.reduce((sum, a) => sum + Number(a.amountAllocated), 0) || 0;
                      const remainingUnallocated = Number(p.amount) - allocatedTotal;
                      // Only CASH payments can have unallocated amounts — credit/refund records are settled at creation
                      const canAllocate = (!p.paymentType || p.paymentType === "CASH") && remainingUnallocated > 0.01;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                          <td className="px-6 py-4 font-mono text-xs text-slate-400">#{p.id}</td>
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                            {new Date(p.paymentDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-950 dark:text-white capitalize">
                            {p.customer?.name}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${typeInfo.cls}`}>
                              {typeInfo.label}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs max-w-xs truncate">
                            {p.allocations && p.allocations.length > 0 ? (
                              p.allocations.map(a => `${a.invoice?.invoiceNo || `Invoice #${a.invoiceId}`} (Rs. ${Number(a.amountAllocated).toFixed(0)})`).join(", ")
                            ) : (
                              <span className="italic text-slate-400">Unallocated</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs">
                            {p.description || <span className="italic text-slate-400">No notes</span>}
                          </td>
                          <td className={`px-6 py-4 text-right font-bold ${
                            p.paymentType === "CASH_REFUND"
                              ? "text-rose-600 dark:text-rose-400"
                              : p.paymentType === "CREDIT_APPLICATION"
                              ? "text-sky-600 dark:text-sky-400"
                              : "text-emerald-600 dark:text-emerald-450"
                          }`}>
                            {p.paymentType === "CASH_REFUND" ? "−" : "+"}Rs. {Number(p.amount).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {canAllocate ? (
                              <button
                                onClick={() => handleOpenAllocateModal(p, remainingUnallocated)}
                                className="text-sky-600 hover:text-sky-500 font-semibold text-xs border border-sky-600/30 hover:border-sky-600/50 px-2 py-1 rounded-lg transition-colors"
                              >
                                Allocate (Rs. {remainingUnallocated.toFixed(0)})
                              </button>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Settled</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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
                    // Use freshly-fetched balance; fall back to list if not yet loaded
                    const liveBalance = freshCustomerBalance !== null
                      ? freshCustomerBalance
                      : Number(customers.find(c => c.id === Number(custForm.customerId))?.balance || 0);
                    const availableCredit = liveBalance < 0 ? Math.abs(liveBalance) : 0;
                    const selectedInvoice = custInvoices.find(inv => inv.id === Number(custForm.invoiceId));

                    return (
                      <>
                        {/* Live balance status banner */}
                        {freshCustomerBalance !== null && (
                          <div className={`text-xs px-3 py-2 rounded-lg font-medium ${
                            liveBalance < 0
                              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                              : "bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                          }`}>
                            {liveBalance < 0
                              ? `✦ Store Credit on Account: Rs. ${Math.abs(liveBalance).toFixed(2)}`
                              : `Ledger Balance: Rs. ${liveBalance.toFixed(2)} outstanding.`
                            }
                          </div>
                        )}

                        {availableCredit > 0 && custInvoices.length > 0 && (
                          <div>
                            <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Payment Method</label>
                            <select
                              value={custForm.isCreditApplied ? "CREDIT" : "CASH"}
                              onChange={(e) => {
                                const isCredit = e.target.value === "CREDIT";
                                const firstInv = custInvoices[0];
                                const autoAmt = isCredit && firstInv
                                  ? Math.min(availableCredit, Number(firstInv.balanceDue)).toFixed(2)
                                  : "";
                                setCustForm({
                                  ...custForm,
                                  isCreditApplied: isCredit,
                                  invoiceId: isCredit ? (firstInv?.id?.toString() || "") : "",
                                  amount: isCredit ? autoAmt : custForm.amount
                                });
                              }}
                              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm font-semibold"
                            >
                              <option value="CASH">Cash Collection (Standard)</option>
                              <option value="CREDIT">Apply Store Credit (Rs. {availableCredit.toFixed(0)} available)</option>
                            </select>
                          </div>
                        )}

                        {availableCredit <= 0 && liveBalance < 0 && custInvoices.length === 0 && (
                          <div className="text-xs px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            Customer has Rs. {Math.abs(liveBalance).toFixed(2)} store credit but no outstanding invoices. Create a new invoice first, or use Refund Credit to pay it out in cash.
                          </div>
                        )}

                        {custForm.isCreditApplied ? (
                          <div>
                            <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">
                              Link to Outstanding Invoice *
                            </label>
                            <select
                              required
                              value={custForm.invoiceId}
                              onChange={(e) => {
                                const inv = custInvoices.find(i => i.id === Number(e.target.value));
                                const autoAmt = inv
                                  ? Math.min(availableCredit, Number(inv.balanceDue)).toFixed(2)
                                  : "";
                                setCustForm({ ...custForm, invoiceId: e.target.value, amount: autoAmt });
                              }}
                              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm font-mono"
                            >
                              <option value="">Select Invoice...</option>
                              {custInvoices.map((inv) => (
                                <option key={inv.id} value={inv.id}>
                                  {inv.invoiceNo} — Due: Rs. {Number(inv.balanceDue).toFixed(0)} | Apply: Rs. {Math.min(availableCredit, Number(inv.balanceDue)).toFixed(0)}
                                </option>
                              ))}
                            </select>
                            {selectedInvoice && (
                              <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">
                                Applying Rs. {Math.min(availableCredit, Number(selectedInvoice.balanceDue)).toFixed(2)} credit · Invoice balance after: Rs. {Math.max(0, Number(selectedInvoice.balanceDue) - Math.min(availableCredit, Number(selectedInvoice.balanceDue))).toFixed(2)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">
                              Allocate to Outstanding Invoices (Optional)
                            </label>
                            {custInvoices.length > 0 ? (
                              <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-850 p-3 space-y-2">
                                {custInvoices.map((inv) => {
                                  const isChecked = !!allocations[inv.id];
                                  return (
                                    <div key={inv.id} className="flex items-center justify-between text-xs py-1">
                                      <label className="flex items-center space-x-2 font-mono text-slate-700 dark:text-slate-350 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              const currentSum = Object.values(allocations).reduce((sum, val) => sum + Number(val || 0), 0);
                                              const remaining = Math.max(0, Number(custForm.amount || 0) - currentSum);
                                              const autoAmt = Math.min(Number(inv.balanceDue), remaining);
                                              setAllocations({ ...allocations, [inv.id]: autoAmt.toString() });
                                            } else {
                                              const next = { ...allocations };
                                              delete next[inv.id];
                                              setAllocations(next);
                                            }
                                          }}
                                          className="rounded text-sky-600 focus:ring-sky-500 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850"
                                        />
                                        <span>{inv.invoiceNo} (Due: Rs.{Number(inv.balanceDue).toFixed(0)})</span>
                                      </label>
                                      {isChecked && (
                                        <input
                                          type="number"
                                          max={Number(inv.balanceDue)}
                                          min={0.01}
                                          step="0.01"
                                          placeholder="Amount"
                                          value={allocations[inv.id] || ""}
                                          onChange={(e) => setAllocations({ ...allocations, [inv.id]: e.target.value })}
                                          className="w-24 px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-right font-semibold text-slate-900 dark:text-white"
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-400 italic py-2">
                                ✓ No outstanding invoices found. Payment will be held as general advance credit.
                              </div>
                            )}
                          </div>
                        )}
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
                        readOnly={custForm.isCreditApplied}
                        className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm font-semibold ${
                          custForm.isCreditApplied ? "opacity-70 cursor-not-allowed" : ""
                        }`}
                      />
                      {custForm.isCreditApplied && (
                        <p className="text-xs text-slate-400 mt-1">Auto-set to invoice balance due.</p>
                      )}
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

          {/* Refund Customer Credit Modal */}
          {isRefundModalOpen && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Refund Store Credit Balance
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Payout outstanding store credit balance to the customer as cash. This will increase their balance back towards zero.
                  </p>
                </div>

                <form onSubmit={handleRefundSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Customer Account *</label>
                    <select
                      required
                      value={refundForm.customerId}
                      onChange={(e) => handleRefundCustomerSelect(e.target.value)}
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

                  {refundForm.customerId && (() => {
                    const liveBalance = freshRefundBalance !== null
                      ? freshRefundBalance
                      : Number(customers.find(c => c.id === Number(refundForm.customerId))?.balance || 0);
                    const availableCredit = liveBalance < 0 ? Math.abs(liveBalance) : 0;

                    return (
                      <>
                        <div className={`text-xs px-3 py-2 rounded-lg font-medium ${
                          liveBalance < 0
                            ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                            : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-450 border border-amber-200 dark:border-amber-800"
                        }`}>
                          {liveBalance < 0
                            ? `✦ Available Credit Balance to Refund: Rs. ${availableCredit.toFixed(2)}`
                            : `Customer has no credit balance on account (Balance is Rs. ${liveBalance.toFixed(2)}).`
                          }
                        </div>
                      </>
                    );
                  })()}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Refund Amount *</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="1"
                        value={refundForm.amount}
                        onChange={(e) => setRefundForm({ ...refundForm, amount: e.target.value })}
                        placeholder="0.00"
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm font-semibold"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Date</label>
                      <input
                        type="date"
                        required
                        value={refundForm.refundDate}
                        onChange={(e) => setRefundForm({ ...refundForm, refundDate: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Description / Notes</label>
                    <input
                      type="text"
                      value={refundForm.description}
                      onChange={(e) => setRefundForm({ ...refundForm, description: e.target.value })}
                      placeholder="e.g. Paid out credit balance to customer"
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                    />
                  </div>

                  <div className="flex space-x-3 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => { setIsRefundModalOpen(false); setFreshRefundBalance(null); }}
                      className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-md shadow-rose-500/20 disabled:bg-rose-800 transition-colors"
                    >
                      {submitting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      ) : (
                        <ArrowRightLeft size={14} className="mr-2" />
                      )}
                      Process Refund
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
                    const supplierBalance = selectedSupplier ? Number(selectedSupplier.balance) : 0;
                    const availableCredit = supplierBalance < 0 ? Math.abs(supplierBalance) : 0;
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

      {/* Post-Creation Allocation Modal */}
      {isAllocateModalOpen && selectedPayment && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Allocate General Balance Payment
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Assign remaining unused store credits of <strong>Rs.{selectedPayment.remainingUnallocated.toFixed(2)}</strong> (from Payment #{selectedPayment.id}) to customer's outstanding invoices.
              </p>
            </div>

            <form onSubmit={handlePostAllocationSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-2">
                  Outstanding Invoices
                </label>
                {paymentInvoices.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-850 p-3 space-y-2">
                    {paymentInvoices.map((inv) => {
                      const isChecked = !!postAllocations[inv.id];
                      return (
                        <div key={inv.id} className="flex items-center justify-between text-xs py-1">
                          <label className="flex items-center space-x-2 font-mono text-slate-700 dark:text-slate-350 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  const currentSum = Object.values(postAllocations).reduce((sum, val) => sum + Number(val || 0), 0);
                                  const remaining = Math.max(0, selectedPayment.remainingUnallocated - currentSum);
                                  const autoAmt = Math.min(Number(inv.balanceDue), remaining);
                                  setPostAllocations({ ...postAllocations, [inv.id]: autoAmt.toString() });
                                } else {
                                  const next = { ...postAllocations };
                                  delete next[inv.id];
                                  setPostAllocations(next);
                                }
                              }}
                              className="rounded text-sky-600 focus:ring-sky-500 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850"
                            />
                            <span>{inv.invoiceNo} (Due: Rs.{Number(inv.balanceDue).toFixed(0)})</span>
                          </label>
                          {isChecked && (
                            <input
                              type="number"
                              max={Number(inv.balanceDue)}
                              min={0.01}
                              step="0.01"
                              placeholder="Amount"
                              value={postAllocations[inv.id] || ""}
                              onChange={(e) => setPostAllocations({ ...postAllocations, [inv.id]: e.target.value })}
                              className="w-24 px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-right font-semibold text-slate-900 dark:text-white"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic py-2 text-center">
                    ✓ No unpaid invoices found for this customer.
                  </div>
                )}
              </div>

              <div className="flex space-x-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsAllocateModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || paymentInvoices.length === 0}
                  className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md shadow-sky-500/20 disabled:opacity-50 transition-colors"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <DollarSign size={14} className="mr-2" />
                  )}
                  Save Allocations
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default Payments;
