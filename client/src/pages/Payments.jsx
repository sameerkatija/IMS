import React, { useState, useEffect } from "react";
import api from "../services/api";
import { CreditCard, Plus, Calendar, Search, ArrowRightLeft, DollarSign, Zap } from "lucide-react";
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
  const [allocateTargetType, setAllocateTargetType] = useState("customer"); // "customer" or "supplier"

  // Live customer balance (re-fetched when customer selected in modal, avoids stale list)
  const [freshCustomerBalance, setFreshCustomerBalance] = useState(null);
  const [freshSupplierBalance, setFreshSupplierBalance] = useState(null);
  const [suppAllocations, setSuppAllocations] = useState({}); // { [purchaseId]: amount }

  // Refund Customer Credit Modal state
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [freshRefundBalance, setFreshRefundBalance] = useState(null);
  const [refundForm, setRefundForm] = useState({
    customerId: "",
    amount: "",
    description: "",
    refundDate: new Date().toISOString().substring(0, 10)
  });

  // Apply Store Credit → Invoice modal state (Customer side)
  const [isApplyCreditModalOpen, setIsApplyCreditModalOpen] = useState(false);
  const [applyCreditInvoices, setApplyCreditInvoices] = useState([]);
  const [freshApplyCreditBalance, setFreshApplyCreditBalance] = useState(null);
  const [applyCreditForm, setApplyCreditForm] = useState({
    customerId: "",
    invoiceId: "",
    amount: "",         // optional — left blank = apply max
  });

  // Apply Supplier Credit → Purchase modal state
  const [isApplySuppCreditModalOpen, setIsApplySuppCreditModalOpen] = useState(false);
  const [applySuppCreditPurchases, setApplySuppCreditPurchases] = useState([]);
  const [freshApplySuppCreditBalance, setFreshApplySuppCreditBalance] = useState(null);
  const [applySuppCreditForm, setApplySuppCreditForm] = useState({
    supplierId: "",
    purchaseId: "",
    amount: "",
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

  // Auto-allocate/redistribute customer payment allocations when amount changes
  useEffect(() => {
    const amt = Number(custForm.amount || 0);
    const checkedInvIds = Object.keys(allocations).map(Number);
    if (checkedInvIds.length === 0 || custForm.isCreditApplied) return;

    let remaining = amt;
    const newAllocations = {};
    for (const inv of custInvoices) {
      if (checkedInvIds.includes(inv.id)) {
        const autoAmt = Math.min(Number(inv.balanceDue), remaining);
        if (autoAmt > 0) {
          newAllocations[inv.id] = autoAmt.toString();
          remaining -= autoAmt;
        } else {
          newAllocations[inv.id] = "0";
        }
      }
    }
    setAllocations(newAllocations);
  }, [custForm.amount]);

  // Auto-allocate/redistribute supplier payment allocations when amount changes
  useEffect(() => {
    const amt = Number(suppForm.amount || 0);
    const checkedPurIds = Object.keys(suppAllocations).map(Number);
    if (checkedPurIds.length === 0 || suppForm.isCreditApplied) return;

    let remaining = amt;
    const newAllocations = {};
    for (const pur of suppPurchases) {
      if (checkedPurIds.includes(pur.id)) {
        const autoAmt = Math.min(Number(pur.balanceDue), remaining);
        if (autoAmt > 0) {
          newAllocations[pur.id] = autoAmt.toString();
          remaining -= autoAmt;
        } else {
          newAllocations[pur.id] = "0";
        }
      }
    }
    setSuppAllocations(newAllocations);
  }, [suppForm.amount]);


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

  // ── Apply Store Credit → Invoice (Customer) ─────────────────────────────────
  const handleApplyCreditCustomerSelect = async (id) => {
    setApplyCreditForm({ customerId: id, invoiceId: "", amount: "" });
    setApplyCreditInvoices([]);
    setFreshApplyCreditBalance(null);
    if (!id) return;
    try {
      const [custRes, invRes] = await Promise.all([
        api.get(`/api/customer/${id}`),
        api.get(`/api/invoice?customerId=${id}&limit=100`)
      ]);
      if (custRes.data) {
        const cust = custRes.data.data || custRes.data;
        setFreshApplyCreditBalance(Number(cust.balance ?? 0));
      }
      if (invRes.data?.type === "success") {
        setApplyCreditInvoices(invRes.data.data.filter(i => i.status !== "PAID"));
      }
    } catch (err) { console.error(err); }
  };

  const handleApplyCreditSubmit = async (e) => {
    e.preventDefault();
    if (!applyCreditForm.customerId || !applyCreditForm.invoiceId) {
      setToast({ message: "Please select a customer and an invoice.", type: "error" });
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        customerId: Number(applyCreditForm.customerId),
        invoiceId: Number(applyCreditForm.invoiceId),
        ...(applyCreditForm.amount ? { amount: Number(applyCreditForm.amount) } : {})
      };
      const res = await api.post("/api/payment/customer/apply-credit", payload);
      if (res.data) {
        setToast({ message: res.data.message || "Store credit applied successfully.", type: "success" });
        fetchCustomerPayments();
        fetchCustomersAndSuppliers();
        setIsApplyCreditModalOpen(false);
        setApplyCreditForm({ customerId: "", invoiceId: "", amount: "" });
        setApplyCreditInvoices([]);
        setFreshApplyCreditBalance(null);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to apply store credit.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Apply Supplier Credit → Purchase ────────────────────────────────────────
  const handleApplySuppCreditSelect = async (id) => {
    setApplySuppCreditForm({ supplierId: id, purchaseId: "", amount: "" });
    setApplySuppCreditPurchases([]);
    setFreshApplySuppCreditBalance(null);
    if (!id) return;
    try {
      const [suppRes, purRes] = await Promise.all([
        api.get(`/api/supplier/${id}`),
        api.get(`/api/purchase?supplierId=${id}&limit=100`)
      ]);
      if (suppRes.data) {
        const supp = suppRes.data.data || suppRes.data;
        setFreshApplySuppCreditBalance(Number(supp.balance ?? 0));
      }
      if (purRes.data?.type === "success") {
        setApplySuppCreditPurchases(purRes.data.data.filter(p => p.status !== "PAID"));
      }
    } catch (err) { console.error(err); }
  };

  const handleApplySuppCreditSubmit = async (e) => {
    e.preventDefault();
    if (!applySuppCreditForm.supplierId || !applySuppCreditForm.purchaseId) {
      setToast({ message: "Please select a supplier and a purchase.", type: "error" });
      return;
    }
    try {
      setSubmitting(true);
      const payload = {
        supplierId: Number(applySuppCreditForm.supplierId),
        purchaseId: Number(applySuppCreditForm.purchaseId),
        ...(applySuppCreditForm.amount ? { amount: Number(applySuppCreditForm.amount) } : {})
      };
      const res = await api.post("/api/payment/supplier/apply-credit", payload);
      if (res.data) {
        setToast({ message: res.data.message || "Supplier credit applied successfully.", type: "success" });
        fetchSupplierPayments();
        fetchCustomersAndSuppliers();
        setIsApplySuppCreditModalOpen(false);
        setApplySuppCreditForm({ supplierId: "", purchaseId: "", amount: "" });
        setApplySuppCreditPurchases([]);
        setFreshApplySuppCreditBalance(null);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to apply supplier credit.", type: "error" });
    } finally {
      setSubmitting(false);
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


  const handleOpenAllocateModal = async (payment, remaining, type = "customer") => {
    setSelectedPayment({ ...payment, remainingUnallocated: remaining });
    setPostAllocations({});
    setAllocateTargetType(type);
    try {
      if (type === "customer") {
        const response = await api.get(`/api/invoice?customerId=${payment.customerId}&limit=100`);
        if (response.data && response.data.type === "success") {
          const outstanding = response.data.data.filter(inv => inv.status !== "PAID");
          setPaymentInvoices(outstanding);
          setIsAllocateModalOpen(true);
        }
      } else {
        const response = await api.get(`/api/purchase?supplierId=${payment.supplierId}&limit=100`);
        if (response.data && response.data.type === "success") {
          const outstanding = response.data.data.filter(pur => pur.status !== "PAID");
          setPaymentInvoices(outstanding);
          setIsAllocateModalOpen(true);
        }
      }
    } catch (err) {
      console.error(err);
      setToast({ message: `Failed to load outstanding ${type === "customer" ? "invoices" : "purchases"}.`, type: "error" });
    }
  };

  const handlePostAllocationSubmit = async (e) => {
    e.preventDefault();
    const isCust = allocateTargetType === "customer";

    const allocationArray = Object.entries(postAllocations)
      .filter(([_, val]) => Number(val) > 0)
      .map(([id, val]) => {
        return isCust
          ? { invoiceId: Number(id), amountAllocated: Number(val) }
          : { purchaseId: Number(id), amountAllocated: Number(val) };
      });

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
      const payload = isCust ? {
        customerPaymentId: selectedPayment.id,
        allocations: allocationArray
      } : {
        supplierPaymentId: selectedPayment.id,
        allocations: allocationArray
      };

      const endpoint = isCust ? "/api/payment/customer/allocate" : "/api/payment/supplier/allocate";
      const response = await api.post(endpoint, payload);
      if (response.data) {
        setToast({ message: "Payment allocations committed successfully.", type: "success" });
        if (isCust) {
          fetchCustomerPayments();
        } else {
          fetchSupplierPayments();
        }
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

  // Load supplier purchases + fresh balance when supplier is selected
  const handleSupplierSelect = async (id) => {
    setSuppForm({ ...suppForm, supplierId: id, purchaseId: "", isCreditApplied: false, amount: "" });
    setSuppAllocations({});
    setFreshSupplierBalance(null);
    if (!id) {
      setSuppPurchases([]);
      return;
    }
    try {
      const [suppRes, purRes] = await Promise.all([
        api.get(`/api/supplier/${id}`),
        api.get(`/api/purchase?supplierId=${id}&limit=100`)
      ]);
      if (suppRes.data) {
        const supp = suppRes.data.data || suppRes.data;
        setFreshSupplierBalance(Number(supp.balance ?? 0));
      }
      if (purRes.data && purRes.data.type === "success") {
        const outstanding = purRes.data.data.filter(p => p.status !== "PAID");
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

    const liveBalance = freshSupplierBalance !== null
      ? freshSupplierBalance
      : Number(suppliers.find(s => s.id === Number(suppForm.supplierId))?.balance || 0);

    if (suppForm.isCreditApplied) {
      if (!suppForm.purchaseId) {
        setToast({ message: "Purchase is required when applying credit.", type: "error" });
        return;
      }
      const availableCredit = liveBalance < 0 ? Math.abs(liveBalance) : 0;
      const selectedPur = suppPurchases.find(p => p.id === Number(suppForm.purchaseId));
      const maxApplicable = selectedPur ? Math.min(availableCredit, Number(selectedPur.balanceDue)) : availableCredit;

      if (Number(suppForm.amount) > maxApplicable) {
        setToast({
          message: `Blocked! Amount (Rs.${suppForm.amount}) exceeds applicable credit (Rs.${maxApplicable.toFixed(2)}) for the selected purchase.`,
          type: "error"
        });
        return;
      }
    } else {
      // General supplier cash payment - allowed to exceed current balance
    }

    const allocationArray = Object.entries(suppAllocations)
      .filter(([_, val]) => Number(val) > 0)
      .map(([purId, val]) => ({ purchaseId: Number(purId), amountAllocated: Number(val) }));

    const totalAllocated = allocationArray.reduce((sum, a) => sum + a.amountAllocated, 0);
    if (totalAllocated > Number(suppForm.amount)) {
      setToast({ message: `Total allocations (Rs. ${totalAllocated}) cannot exceed payment amount (Rs. ${suppForm.amount}).`, type: "error" });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        supplierId: Number(suppForm.supplierId),
        purchaseId: suppForm.isCreditApplied ? Number(suppForm.purchaseId) : null,
        amount: Number(suppForm.amount),
        isCreditApplied: suppForm.isCreditApplied,
        description: suppForm.description || null,
        paymentDate: suppForm.paymentDate ? new Date(suppForm.paymentDate).toISOString() : undefined,
        allocations: suppForm.isCreditApplied
          ? [{ purchaseId: Number(suppForm.purchaseId), amountAllocated: Number(suppForm.amount) }]
          : allocationArray
      };

      const response = await api.post("/api/payment/supplier", payload);
      if (response.data) {
        setToast({ message: suppForm.isCreditApplied ? "Supplier credit applied successfully." : "Supplier payment registered successfully.", type: "success" });
        fetchSupplierPayments();
        fetchCustomersAndSuppliers(); // sync balances
        setIsSuppPaymentModalOpen(false);
        setSuppForm({ supplierId: "", purchaseId: "", amount: "", isCreditApplied: false, description: "", paymentDate: new Date().toISOString().substring(0, 10) });
        setSuppAllocations({});
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
            className={`py-4 border-b-2 px-1 transition-all ${activeTab === "customers"
              ? "border-sky-600 text-sky-600 dark:text-sky-400 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
              }`}
          >
            Customer Payouts (Collections)
          </button>
          <button
            onClick={() => setActiveTab("suppliers")}
            className={`py-4 border-b-2 px-1 transition-all ${activeTab === "suppliers"
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
                className="inline-flex items-center justify-center px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-rose-500/20 active:scale-95 transition-all duration-150"
              >
                <ArrowRightLeft size={16} className="mr-2" /> Refund Store Credit
              </button>
              <button
                onClick={() => { setIsApplyCreditModalOpen(true); setApplyCreditForm({ customerId: "", invoiceId: "", amount: "" }); setApplyCreditInvoices([]); setFreshApplyCreditBalance(null); }}
                className="inline-flex items-center justify-center px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-violet-500/20 active:scale-95 transition-all duration-150"
              >
                <Zap size={16} className="mr-2" /> Apply Store Credit
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
                          <td className={`px-6 py-4 text-right font-bold ${p.paymentType === "CASH_REFUND"
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
                          <div className={`text-xs px-3 py-2 rounded-lg font-medium ${liveBalance < 0
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
                                              let amt = Number(custForm.amount || 0);
                                              if (amt === 0) {
                                                amt = Number(inv.balanceDue);
                                                setCustForm({ ...custForm, amount: amt.toString() });
                                              }
                                              const currentSum = Object.values(allocations).reduce((sum, val) => sum + Number(val || 0), 0);
                                              const remaining = Math.max(0, amt - currentSum);
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
                                ✓ No outstanding invoices found.
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
                        className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm font-semibold ${custForm.isCreditApplied ? "opacity-70 cursor-not-allowed" : ""
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
                        <div className={`text-xs px-3 py-2 rounded-lg font-medium ${liveBalance < 0
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
          {/* ── Apply Store Credit → Invoice Modal (Customer) ───────────────── */}
          {isApplyCreditModalOpen && (() => {
            const liveBalance = freshApplyCreditBalance !== null
              ? freshApplyCreditBalance
              : Number(customers.find(c => c.id === Number(applyCreditForm.customerId))?.balance || 0);
            const availableCredit = liveBalance < 0 ? Math.abs(liveBalance) : 0;
            const selectedInvoice = applyCreditInvoices.find(i => i.id === Number(applyCreditForm.invoiceId));
            const invoiceDue = selectedInvoice ? Number(selectedInvoice.balanceDue) : 0;
            const requestedAmt = applyCreditForm.amount ? Number(applyCreditForm.amount) : availableCredit;
            const willApply = Math.min(requestedAmt, availableCredit, invoiceDue);

            return (
              <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Zap size={18} className="text-violet-500" /> Apply Store Credit to Invoice
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Settle an existing invoice using the customer's available credit balance. No cash changes hands.
                    </p>
                  </div>

                  <form onSubmit={handleApplyCreditSubmit} className="space-y-4">
                    {/* Customer picker */}
                    <div>
                      <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Customer *</label>
                      <select
                        required
                        value={applyCreditForm.customerId}
                        onChange={(e) => handleApplyCreditCustomerSelect(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-violet-500 outline-none text-sm"
                      >
                        <option value="">Select Customer...</option>
                        {customers
                          .filter(c => Number(c.balance) < 0)
                          .map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} — Credit: Rs. {Math.abs(Number(c.balance)).toFixed(0)}
                            </option>
                          ))}
                      </select>
                      {customers.filter(c => Number(c.balance) < 0).length === 0 && (
                        <p className="text-xs text-slate-400 italic mt-1">No customers currently have a store credit balance.</p>
                      )}
                    </div>

                    {/* Credit balance banner */}
                    {applyCreditForm.customerId && freshApplyCreditBalance !== null && (
                      <div className={`text-xs px-3 py-2 rounded-lg font-medium border ${
                        availableCredit > 0
                          ? "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800"
                          : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                      }`}>
                        {availableCredit > 0
                          ? `✦ Available store credit: Rs. ${availableCredit.toFixed(2)}`
                          : `Customer has no credit balance (Balance: Rs. ${liveBalance.toFixed(2)}).`
                        }
                      </div>
                    )}

                    {/* Invoice picker */}
                    {applyCreditForm.customerId && availableCredit > 0 && (
                      <div>
                        <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Outstanding Invoice *</label>
                        {applyCreditInvoices.length === 0 ? (
                          <div className="text-xs text-amber-600 dark:text-amber-400 italic py-1">
                            No outstanding invoices for this customer. Create an invoice first.
                          </div>
                        ) : (
                          <select
                            required
                            value={applyCreditForm.invoiceId}
                            onChange={(e) => {
                              const inv = applyCreditInvoices.find(i => i.id === Number(e.target.value));
                              const autoAmt = inv ? Math.min(availableCredit, Number(inv.balanceDue)).toFixed(2) : "";
                              setApplyCreditForm({ ...applyCreditForm, invoiceId: e.target.value, amount: autoAmt });
                            }}
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-violet-500 outline-none text-sm font-mono"
                          >
                            <option value="">Select Invoice...</option>
                            {applyCreditInvoices.map(inv => (
                              <option key={inv.id} value={inv.id}>
                                {inv.invoiceNo} — Due: Rs. {Number(inv.balanceDue).toFixed(0)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    {/* Amount field + live preview */}
                    {applyCreditForm.invoiceId && selectedInvoice && (
                      <>
                        <div>
                          <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">
                            Amount to Apply (PKR) <span className="normal-case font-normal text-slate-400">— leave blank to apply maximum</span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder={`Max: Rs. ${Math.min(availableCredit, invoiceDue).toFixed(2)}`}
                            value={applyCreditForm.amount}
                            onChange={(e) => setApplyCreditForm({ ...applyCreditForm, amount: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-violet-500 outline-none text-sm font-semibold"
                          />
                        </div>

                        {/* Live impact preview */}
                        <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-3 space-y-1 text-xs">
                          <div className="flex justify-between text-slate-600 dark:text-slate-300">
                            <span>Credit to be applied</span>
                            <span className="font-bold text-violet-700 dark:text-violet-300">Rs. {willApply.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600 dark:text-slate-300">
                            <span>Invoice balance after</span>
                            <span className="font-bold">{invoiceDue > 0 ? `Rs. ${Math.max(0, invoiceDue - willApply).toFixed(2)}` : "—"}</span>
                          </div>
                          <div className="flex justify-between text-slate-600 dark:text-slate-300">
                            <span>Customer credit remaining</span>
                            <span className="font-bold">{availableCredit > 0 ? `Rs. ${Math.max(0, availableCredit - willApply).toFixed(2)}` : "—"}</span>
                          </div>
                          {applyCreditForm.amount && Number(applyCreditForm.amount) > Math.min(availableCredit, invoiceDue) && (
                            <p className="text-amber-600 dark:text-amber-400 mt-1">
                              ⚠ Amount exceeds limit — will be auto-capped to Rs. {Math.min(availableCredit, invoiceDue).toFixed(2)}
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    <div className="flex space-x-3 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => { setIsApplyCreditModalOpen(false); setFreshApplyCreditBalance(null); }}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || !applyCreditForm.invoiceId || availableCredit <= 0}
                        className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl shadow-md shadow-violet-500/20 disabled:opacity-50 transition-colors"
                      >
                        {submitting ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        ) : (
                          <Zap size={14} className="mr-2" />
                        )}
                        Apply Credit
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            );
          })()}
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
            <div className="flex space-x-3">
              <button
                onClick={() => { setIsApplySuppCreditModalOpen(true); setApplySuppCreditForm({ supplierId: "", purchaseId: "", amount: "" }); setApplySuppCreditPurchases([]); setFreshApplySuppCreditBalance(null); }}
                className="inline-flex items-center justify-center px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-violet-500/20 active:scale-95 transition-all duration-150"
              >
                <Zap size={16} className="mr-2" /> Apply Supplier Credit
              </button>
              <button
                onClick={() => setIsSuppPaymentModalOpen(true)}
                className="inline-flex items-center justify-center px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 active:scale-95 transition-all duration-150"
              >
                <Plus size={16} className="mr-2" /> Log Supplier Settlement
              </button>
            </div>
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
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {supplierPayments.map((p) => {
                      const allocatedTotal = p.allocations?.reduce((sum, a) => sum + Number(a.amountAllocated), 0) || 0;
                      const remainingUnallocated = Number(p.amount) - allocatedTotal;
                      const canAllocate = remainingUnallocated > 0.01;

                      return (
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
                          <td className="px-6 py-4 font-mono text-xs max-w-xs truncate">
                            {p.allocations && p.allocations.length > 0 ? (
                              p.allocations.map(a => `${a.purchase?.purchaseNo || `Purchase #${a.purchaseId}`} (Rs. ${Number(a.amountAllocated).toFixed(0)})`).join(", ")
                            ) : (
                              <span className="italic text-slate-400">Unallocated</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs">
                            {p.description || <span className="italic text-slate-400">No notes</span>}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-rose-600 dark:text-rose-450">
                            Rs. {Number(p.amount).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right">
                            {canAllocate ? (
                              <button
                                onClick={() => handleOpenAllocateModal(p, remainingUnallocated, "supplier")}
                                className="text-sky-600 hover:text-sky-500 font-semibold text-xs border border-sky-600/30 hover:border-sky-600/50 px-2 py-1 rounded-lg transition-colors"
                              >
                                Allocate (Rs. {remainingUnallocated.toFixed(0)})
                              </button>
                            ) : (
                              <span className="text-slate-400 text-xs italic">✓ Allocated</span>
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

                  {suppForm.supplierId && (() => {
                    const liveBalance = freshSupplierBalance !== null
                      ? freshSupplierBalance
                      : Number(suppliers.find(s => s.id === Number(suppForm.supplierId))?.balance || 0);
                    const availableCredit = liveBalance < 0 ? Math.abs(liveBalance) : 0;
                    const selectedPurchase = suppPurchases.find(p => p.id === Number(suppForm.purchaseId));

                    return (
                      <>
                        {/* Live balance status banner */}
                        {freshSupplierBalance !== null && (
                          <div className={`text-xs px-3 py-2 rounded-lg font-medium ${liveBalance < 0
                            ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                            : "bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                            }`}>
                            {liveBalance < 0
                              ? `✦ Store Credit on Account: Rs. ${Math.abs(liveBalance).toFixed(2)}`
                              : `Ledger Balance: Rs. ${liveBalance.toFixed(2)} outstanding owed.`
                            }
                          </div>
                        )}

                        {availableCredit > 0 && suppPurchases.length > 0 && (
                          <div>
                            <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Payment Method</label>
                            <select
                              value={suppForm.isCreditApplied ? "credit" : "cash"}
                              onChange={(e) => {
                                const isCredit = e.target.value === "credit";
                                const firstPur = suppPurchases[0];
                                const autoAmt = isCredit && firstPur
                                  ? Math.min(availableCredit, Number(firstPur.balanceDue)).toFixed(2)
                                  : "";
                                setSuppForm({
                                  ...suppForm,
                                  isCreditApplied: isCredit,
                                  purchaseId: isCredit ? (firstPur?.id?.toString() || "") : "",
                                  amount: isCredit ? autoAmt : suppForm.amount
                                });
                              }}
                              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm font-semibold"
                            >
                              <option value="cash">Cash / Bank Payment</option>
                              <option value="credit">Apply Supplier Credit (Rs. {availableCredit.toFixed(0)} available)</option>
                            </select>
                          </div>
                        )}

                        {availableCredit <= 0 && liveBalance < 0 && suppPurchases.length === 0 && (
                          <div className="text-xs px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                            Supplier has Rs. {Math.abs(liveBalance).toFixed(2)} store credit but no outstanding purchases.
                          </div>
                        )}

                        {suppForm.isCreditApplied ? (
                          <div>
                            <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">
                              Link to Outstanding Purchase *
                            </label>
                            <select
                              required
                              value={suppForm.purchaseId}
                              onChange={(e) => {
                                const pur = suppPurchases.find(p => p.id === Number(e.target.value));
                                const autoAmt = pur
                                  ? Math.min(availableCredit, Number(pur.balanceDue)).toFixed(2)
                                  : "";
                                setSuppForm({ ...suppForm, purchaseId: e.target.value, amount: autoAmt });
                              }}
                              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm font-mono"
                            >
                              <option value="">Select Purchase...</option>
                              {suppPurchases.map((pur) => (
                                <option key={pur.id} value={pur.id}>
                                  {pur.purchaseNo} — Due: Rs. {Number(pur.balanceDue).toFixed(0)} | Apply: Rs. {Math.min(availableCredit, Number(pur.balanceDue)).toFixed(0)}
                                </option>
                              ))}
                            </select>
                            {selectedPurchase && (
                              <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">
                                Applying Rs. {Math.min(availableCredit, Number(selectedPurchase.balanceDue)).toFixed(2)} credit · Purchase balance after: Rs. {Math.max(0, Number(selectedPurchase.balanceDue) - Math.min(availableCredit, Number(selectedPurchase.balanceDue))).toFixed(2)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">
                              Allocate to Outstanding Purchases (Optional)
                            </label>
                            {suppPurchases.length > 0 ? (
                              <div className="max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-850 p-3 space-y-2">
                                {suppPurchases.map((pur) => {
                                  const isChecked = !!suppAllocations[pur.id];
                                  return (
                                    <div key={pur.id} className="flex items-center justify-between text-xs py-1">
                                      <label className="flex items-center space-x-2 font-mono text-slate-700 dark:text-slate-350 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              let amt = Number(suppForm.amount || 0);
                                              if (amt === 0) {
                                                amt = Number(pur.balanceDue);
                                                setSuppForm({ ...suppForm, amount: amt.toString() });
                                              }
                                              const currentSum = Object.values(suppAllocations).reduce((sum, val) => sum + Number(val || 0), 0);
                                              const remaining = Math.max(0, amt - currentSum);
                                              const autoAmt = Math.min(Number(pur.balanceDue), remaining);
                                              setSuppAllocations({ ...suppAllocations, [pur.id]: autoAmt.toString() });
                                            } else {
                                              const next = { ...suppAllocations };
                                              delete next[pur.id];
                                              setSuppAllocations(next);
                                            }
                                          }}
                                          className="rounded text-sky-600 focus:ring-sky-500 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-850"
                                        />
                                        <span>{pur.purchaseNo} (Due: Rs.{Number(pur.balanceDue).toFixed(0)})</span>
                                      </label>
                                      {isChecked && (
                                        <input
                                          type="number"
                                          max={Number(pur.balanceDue)}
                                          min={0.01}
                                          step="0.01"
                                          placeholder="Amount"
                                          value={suppAllocations[pur.id] || ""}
                                          onChange={(e) => setSuppAllocations({ ...suppAllocations, [pur.id]: e.target.value })}
                                          className="w-24 px-2 py-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-right font-semibold text-slate-900 dark:text-white"
                                        />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-400 italic py-2">
                                ✓ No outstanding purchases found.
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
                        value={suppForm.amount}
                        onChange={(e) => setSuppForm({ ...suppForm, amount: e.target.value })}
                        placeholder="0.00"
                        readOnly={suppForm.isCreditApplied}
                        className={`w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm font-semibold ${suppForm.isCreditApplied ? "opacity-70 cursor-not-allowed" : ""}`}
                      />
                      {suppForm.isCreditApplied && (
                        <p className="text-xs text-slate-400 mt-1">Auto-set to purchase balance due.</p>
                      )}
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

         {/* Post-Creation Allocation Modal */}
      {isAllocateModalOpen && selectedPayment && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Allocate General Balance Payment
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Assign remaining unused store credits of <strong>Rs.{selectedPayment.remainingUnallocated.toFixed(2)}</strong> (from Payment #{selectedPayment.id}) to {allocateTargetType === "customer" ? "customer's outstanding invoices" : "supplier's outstanding purchases"}.
              </p>
            </div>

            <form onSubmit={handlePostAllocationSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-2">
                  {allocateTargetType === "customer" ? "Outstanding Invoices" : "Outstanding Purchases"}
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
                            <span>{inv.invoiceNo || inv.purchaseNo} (Due: Rs.{Number(inv.balanceDue).toFixed(0)})</span>
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
                    {allocateTargetType === "customer"
                      ? "✓ No unpaid invoices found for this customer."
                      : "✓ No unpaid purchases found for this supplier."
                    }
                  </div>
                )}
              </div>

              <div className="flex space-x-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setIsAllocateModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-350 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition-colors"
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
      )}

          {/* ── Apply Supplier Credit → Purchase Modal ─────────────────────── */}
          {isApplySuppCreditModalOpen && (() => {
            const liveBalance = freshApplySuppCreditBalance !== null
              ? freshApplySuppCreditBalance
              : Number(suppliers.find(s => s.id === Number(applySuppCreditForm.supplierId))?.balance || 0);
            const availableCredit = liveBalance < 0 ? Math.abs(liveBalance) : 0;
            const selectedPurchase = applySuppCreditPurchases.find(p => p.id === Number(applySuppCreditForm.purchaseId));
            const purchaseDue = selectedPurchase ? Number(selectedPurchase.balanceDue) : 0;
            const requestedAmt = applySuppCreditForm.amount ? Number(applySuppCreditForm.amount) : availableCredit;
            const willApply = Math.min(requestedAmt, availableCredit, purchaseDue);

            return (
              <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Zap size={18} className="text-violet-500" /> Apply Supplier Credit to Purchase
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Offset an existing purchase balance using the supplier's credit (from over-payments or purchase returns).
                    </p>
                  </div>

                  <form onSubmit={handleApplySuppCreditSubmit} className="space-y-4">
                    {/* Supplier picker */}
                    <div>
                      <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Supplier *</label>
                      <select
                        required
                        value={applySuppCreditForm.supplierId}
                        onChange={(e) => handleApplySuppCreditSelect(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-violet-500 outline-none text-sm"
                      >
                        <option value="">Select Supplier...</option>
                        {suppliers
                          .filter(s => Number(s.balance) < 0)
                          .map(s => (
                            <option key={s.id} value={s.id}>
                              {s.name} — Credit: Rs. {Math.abs(Number(s.balance)).toFixed(0)}
                            </option>
                          ))}
                      </select>
                      {suppliers.filter(s => Number(s.balance) < 0).length === 0 && (
                        <p className="text-xs text-slate-400 italic mt-1">No suppliers currently have a credit balance.</p>
                      )}
                    </div>

                    {/* Credit balance banner */}
                    {applySuppCreditForm.supplierId && freshApplySuppCreditBalance !== null && (
                      <div className={`text-xs px-3 py-2 rounded-lg font-medium border ${
                        availableCredit > 0
                          ? "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800"
                          : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800"
                      }`}>
                        {availableCredit > 0
                          ? `✦ Available supplier credit: Rs. ${availableCredit.toFixed(2)}`
                          : `Supplier has no credit balance (Balance: Rs. ${liveBalance.toFixed(2)}).`
                        }
                      </div>
                    )}

                    {/* Purchase picker */}
                    {applySuppCreditForm.supplierId && availableCredit > 0 && (
                      <div>
                        <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Outstanding Purchase *</label>
                        {applySuppCreditPurchases.length === 0 ? (
                          <div className="text-xs text-amber-600 dark:text-amber-400 italic py-1">
                            No outstanding purchases for this supplier.
                          </div>
                        ) : (
                          <select
                            required
                            value={applySuppCreditForm.purchaseId}
                            onChange={(e) => {
                              const pur = applySuppCreditPurchases.find(p => p.id === Number(e.target.value));
                              const autoAmt = pur ? Math.min(availableCredit, Number(pur.balanceDue)).toFixed(2) : "";
                              setApplySuppCreditForm({ ...applySuppCreditForm, purchaseId: e.target.value, amount: autoAmt });
                            }}
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-violet-500 outline-none text-sm font-mono"
                          >
                            <option value="">Select Purchase...</option>
                            {applySuppCreditPurchases.map(pur => (
                              <option key={pur.id} value={pur.id}>
                                {pur.purchaseNo} — Due: Rs. {Number(pur.balanceDue).toFixed(0)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}

                    {/* Amount + preview */}
                    {applySuppCreditForm.purchaseId && selectedPurchase && (
                      <>
                        <div>
                          <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">
                            Amount to Apply (PKR) <span className="normal-case font-normal text-slate-400">— leave blank to apply maximum</span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder={`Max: Rs. ${Math.min(availableCredit, purchaseDue).toFixed(2)}`}
                            value={applySuppCreditForm.amount}
                            onChange={(e) => setApplySuppCreditForm({ ...applySuppCreditForm, amount: e.target.value })}
                            className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-violet-500 outline-none text-sm font-semibold"
                          />
                        </div>

                        <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800 rounded-xl p-3 space-y-1 text-xs">
                          <div className="flex justify-between text-slate-600 dark:text-slate-300">
                            <span>Credit to be applied</span>
                            <span className="font-bold text-violet-700 dark:text-violet-300">Rs. {willApply.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-slate-600 dark:text-slate-300">
                            <span>Purchase balance after</span>
                            <span className="font-bold">{purchaseDue > 0 ? `Rs. ${Math.max(0, purchaseDue - willApply).toFixed(2)}` : "—"}</span>
                          </div>
                          <div className="flex justify-between text-slate-600 dark:text-slate-300">
                            <span>Supplier credit remaining</span>
                            <span className="font-bold">{availableCredit > 0 ? `Rs. ${Math.max(0, availableCredit - willApply).toFixed(2)}` : "—"}</span>
                          </div>
                          {applySuppCreditForm.amount && Number(applySuppCreditForm.amount) > Math.min(availableCredit, purchaseDue) && (
                            <p className="text-amber-600 dark:text-amber-400 mt-1">
                              ⚠ Amount exceeds limit — will be auto-capped to Rs. {Math.min(availableCredit, purchaseDue).toFixed(2)}
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    <div className="flex space-x-3 justify-end pt-2">
                      <button
                        type="button"
                        onClick={() => { setIsApplySuppCreditModalOpen(false); setFreshApplySuppCreditBalance(null); }}
                        className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-xl transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submitting || !applySuppCreditForm.purchaseId || availableCredit <= 0}
                        className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl shadow-md shadow-violet-500/20 disabled:opacity-50 transition-colors"
                      >
                        {submitting ? (
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                        ) : (
                          <Zap size={14} className="mr-2" />
                        )}
                        Apply Credit
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            );
          })()}

    </div>
  );
};

export default Payments;
