import React, { useState, useEffect } from "react";
import api from "../services/api";
import { Receipt, Plus, Search, Eye, Printer, Trash2, Calendar, Edit3, CheckCircle, Lock, AlertTriangle, X } from "lucide-react";
import Toast from "../components/Toast";
import { useAuth } from "../context/AuthContext";
import { formatCurrency, formatCurrencyNoDecimals } from "../utils/format";

const Invoices = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);

  const calculateInvoiceProfit = (invoice) => {
    const cogs = (invoice.items || []).reduce((sum, item) => {
      return sum + Number(item.quantity) * Number(item.costPriceAtSale || 0);
    }, 0);
    return Number(invoice.total) - cogs;
  };

  const [customers, setCustomers] = useState([]);
  const [salesmen, setSalesmen] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);

  // Search & Filter
  const [searchNo, setSearchNo] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [docStatusFilter, setDocStatusFilter] = useState("all");

  // Create / Edit Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingInvoiceId, setEditingInvoiceId] = useState(null);
  const [editingInvoiceNo, setEditingInvoiceNo] = useState("");

  const [customerId, setCustomerId] = useState("");
  const [salesmanId, setSalesmanId] = useState("");
  const [saleType, setSaleType] = useState("CASH"); // CASH vs CREDIT
  const [discount, setDiscount] = useState("0");
  const [discountType, setDiscountType] = useState("%"); // default is %
  const [transportDiscount, setTransportDiscount] = useState("0");
  const [transportDiscountType, setTransportDiscountType] = useState("%"); // default is %
  const [paidAmount, setPaidAmount] = useState("0");
  const [creditApplied, setCreditApplied] = useState("0");
  const [description, setDescription] = useState("");

  // Items state with row-level discountType and discountValue
  const [items, setItems] = useState([
    { productId: "", quantity: "1", unitPrice: "", discountType: "PKR", discountValue: "0" }
  ]);
  const [searchQueries, setSearchQueries] = useState([""]);
  const [openDropdownIndex, setOpenDropdownIndex] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Confirmation & Delete Modal State
  const [confirmModalInvoice, setConfirmModalInvoice] = useState(null);
  const [deleteModalInvoice, setDeleteModalInvoice] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Print & Details State
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [printFormat, setPrintFormat] = useState("a4"); // a4 vs thermal

  const selectedInvoiceTotalReturns = selectedInvoice
    ? (selectedInvoice.salesReturns || []).reduce((sum, ret) => sum + Number(ret.totalAmount || 0), 0)
    : 0;

  const selectedInvoiceCalculatedBalanceDue = selectedInvoice
    ? Math.max(
        0,
        Number(selectedInvoice.total) -
          Number(selectedInvoice.transportDiscount || 0) -
          Number(selectedInvoice.paidAmount || 0) -
          Number(selectedInvoice.creditApplied || 0) -
          selectedInvoiceTotalReturns
      )
    : 0;

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      let queryParams = `?page=${page}&limit=${limit}`;
      if (searchNo.trim()) queryParams += `&search=${encodeURIComponent(searchNo)}`;
      if (statusFilter !== "all") queryParams += `&status=${statusFilter}`;
      if (docStatusFilter !== "all") queryParams += `&documentStatus=${docStatusFilter}`;

      const response = await api.get(`/api/invoice${queryParams}`);
      if (response.data && response.data.type === "success") {
        setInvoices(response.data.data);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load sales history.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchDependencies = async () => {
    try {
      const [custRes, salesRes, prodRes] = await Promise.all([
        api.get("/api/customer?limit=100&isActive=true"),
        api.get("/api/salesman?limit=100&isActive=true"),
        api.get("/api/product?limit=200&isActive=true")
      ]);
      if (custRes.data?.type === "success") setCustomers(custRes.data.data);
      if (salesRes.data?.type === "success") setSalesmen(salesRes.data.data);
      if (prodRes.data?.type === "success") setProducts(prodRes.data.data);
    } catch (err) {
      console.error("Error fetching POS data:", err);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, [page, searchNo, statusFilter, docStatusFilter]);

  useEffect(() => {
    fetchDependencies();
  }, []);

  const addItemRow = () => {
    setItems([...items, { productId: "", quantity: "1", unitPrice: "", discountType: "PKR", discountValue: "0" }]);
    setSearchQueries([...searchQueries, ""]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
    setSearchQueries(searchQueries.filter((_, idx) => idx !== index));
    if (openDropdownIndex === index) setOpenDropdownIndex(null);
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    if (field === "productId" && value) {
      const selectedProd = products.find(p => p.id === Number(value));
      if (selectedProd) {
        updated[index].unitPrice = selectedProd.sellingPrice.toString();
        if (selectedProd.stockQuantity === 0) {
          setToast({ message: `${selectedProd.name} is currently out of stock!`, type: "error" });
        }
      }
    }

    if (field === "quantity" && value && updated[index].productId) {
      const selectedProd = products.find(p => p.id === Number(updated[index].productId));
      if (selectedProd && Number(value) > selectedProd.stockQuantity) {
        setToast({
          message: `Insufficient stock! ${selectedProd.name} only has ${selectedProd.stockQuantity} pieces.`,
          type: "error"
        });
      }
    }

    setItems(updated);
  };

  // Helper: compute row-level discount amount, net rate, and subtotal
  const computeRowValues = (item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    const discInput = Number(item.discountValue || 0);

    let lineDiscount = 0;
    let netRate = price;

    if (item.discountType === "%") {
      lineDiscount = ((qty * price) * discInput) / 100;
      netRate = price * (1 - discInput / 100);
    } else if (item.discountType === "PER_PIECE") {
      lineDiscount = qty * discInput;
      netRate = price - discInput;
    } else {
      // PKR fixed total
      lineDiscount = discInput;
      netRate = qty > 0 ? price - (discInput / qty) : price;
    }

    lineDiscount = Math.max(0, lineDiscount);
    netRate = Math.max(0, Math.round(netRate * 100) / 100);
    const lineSubtotal = Math.max(0, Math.round(((qty * price) - lineDiscount) * 100) / 100);

    return { lineDiscount, netRate, lineSubtotal };
  };

  // Totals calculations
  const subtotal = items.reduce((acc, curr) => {
    const { lineSubtotal } = computeRowValues(curr);
    return acc + lineSubtotal;
  }, 0);

  const calculatedDiscountAmount = discountType === "%"
    ? (subtotal * (Number(discount) || 0)) / 100
    : (Number(discount) || 0);

  const total = Math.max(0, subtotal - calculatedDiscountAmount);

  const calculatedTransportDiscountAmount = transportDiscountType === "%"
    ? (total * (Number(transportDiscount) || 0)) / 100
    : (Number(transportDiscount) || 0);

  const netPayable = Math.max(0, Math.round((total - calculatedTransportDiscountAmount) * 100) / 100);

  // Automatically match paidAmount when CASH mode is selected
  useEffect(() => {
    if (saleType === "CASH") {
      setPaidAmount(netPayable.toString());
      setCreditApplied("0");
    } else {
      if (!editingInvoiceId) {
        setPaidAmount("0");
      }
    }
  }, [saleType, netPayable, editingInvoiceId]);

  const resetForm = () => {
    setEditingInvoiceId(null);
    setEditingInvoiceNo("");
    setCustomerId("");
    setSalesmanId("");
    setSaleType("CASH");
    setDiscount("0");
    setDiscountType("%");
    setTransportDiscount("0");
    setTransportDiscountType("%");
    setPaidAmount("0");
    setCreditApplied("0");
    setDescription("");
    setItems([{ productId: "", quantity: "1", unitPrice: "", discountType: "PKR", discountValue: "0" }]);
    setSearchQueries([""]);
    setOpenDropdownIndex(null);
    setIsFormOpen(false);
  };

  const openCreateForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const openEditDraftForm = async (inv) => {
    try {
      setLoading(true);
      const res = await api.get(`/api/invoice/${inv.id}`);
      if (res.data && res.data.type === "success") {
        const fullInv = res.data.data;
        if (fullInv.documentStatus === "POSTED") {
          setToast({ message: "Confirmed invoices are immutable and cannot be edited.", type: "error" });
          return;
        }

        setEditingInvoiceId(fullInv.id);
        setEditingInvoiceNo(fullInv.invoiceNo);
        setCustomerId(fullInv.customerId ? fullInv.customerId.toString() : "");
        setSalesmanId(fullInv.salesmanId ? fullInv.salesmanId.toString() : "");
        setSaleType(fullInv.saleType || "CASH");
        setDiscount(fullInv.discount ? fullInv.discount.toString() : "0");
        setDiscountType("PKR");
        setTransportDiscount(fullInv.transportDiscount ? fullInv.transportDiscount.toString() : "0");
        setTransportDiscountType("PKR");
        setPaidAmount(fullInv.paidAmount ? fullInv.paidAmount.toString() : "0");
        setCreditApplied(fullInv.creditApplied ? fullInv.creditApplied.toString() : "0");
        setDescription(fullInv.description || "");

        if (fullInv.items && fullInv.items.length > 0) {
          const loadedItems = fullInv.items.map((it) => {
            const qty = Number(it.quantity) || 1;
            const unitP = Number(it.unitPrice) || 0;
            const totalP = Number(it.totalPrice) || 0;
            const itemDisc = Math.max(0, (qty * unitP) - totalP);
            return {
              productId: it.productId.toString(),
              quantity: it.quantity.toString(),
              unitPrice: it.unitPrice.toString(),
              discountType: "PKR",
              discountValue: itemDisc.toString(),
            };
          });
          setItems(loadedItems);
          setSearchQueries(
            loadedItems.map((it) => {
              const p = products.find((prod) => prod.id === Number(it.productId));
              return p ? `${p.name}${p.size ? ` (${p.size})` : ""}` : "";
            })
          );
        } else {
          setItems([{ productId: "", quantity: "1", unitPrice: "", discountType: "PKR", discountValue: "0" }]);
          setSearchQueries([""]);
        }

        setIsFormOpen(true);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load draft invoice details for editing.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleInvoiceSubmit = async (targetDocStatus = "POSTED") => {
    if (targetDocStatus === "POSTED" && saleType === "CREDIT" && !customerId) {
      setToast({ message: "A registered customer account is required for credit sales.", type: "error" });
      return;
    }

    const validItems = items.filter(it => it.productId && Number(it.quantity) > 0 && Number(it.unitPrice) >= 0);
    if (validItems.length === 0) {
      setToast({ message: "Invoice must contain at least one valid item.", type: "error" });
      return;
    }

    // Verify stock availability if posting
    let totalCost = 0;
    for (let it of validItems) {
      const p = products.find(prod => prod.id === Number(it.productId));
      if (p) {
        if (targetDocStatus === "POSTED" && Number(it.quantity) > p.stockQuantity) {
          setToast({ message: `Cannot sell ${it.quantity} pieces of ${p.name}. Only ${p.stockQuantity} available in stock.`, type: "error" });
          return;
        }
        totalCost += Number(it.quantity) * Number(p.costPrice);
      }
    }

    if (total < totalCost) {
      setToast({
        message: `Invoice discount is too high. Invoice total after standard discount (Rs. ${formatCurrency(total)}) cannot go below the total cost price of the items (Rs. ${formatCurrency(totalCost)}).`,
        type: "error"
      });
      return;
    }

    try {
      setSubmitting(true);
      if (Number(paidAmount) + Number(creditApplied) > netPayable) {
        setToast({ message: "Paid amount and applied credit cannot exceed net payable total.", type: "error" });
        return;
      }

      const payload = {
        customerId: customerId ? Number(customerId) : null,
        salesmanId: salesmanId ? Number(salesmanId) : null,
        saleType,
        discount: calculatedDiscountAmount,
        transportDiscount: calculatedTransportDiscountAmount,
        paidAmount: Number(paidAmount) || 0,
        creditApplied: Number(creditApplied) || 0,
        documentStatus: targetDocStatus,
        description: description || null,
        items: validItems.map(it => {
          const { lineDiscount } = computeRowValues(it);
          return {
            productId: Number(it.productId),
            quantity: Number(it.quantity),
            unitPrice: Number(it.unitPrice),
            discount: lineDiscount,
          };
        })
      };

      let response;
      if (editingInvoiceId) {
        response = await api.put(`/api/invoice/${editingInvoiceId}`, payload);
      } else {
        response = await api.post("/api/invoice", payload);
      }

      if (response.data && response.data.type === "success") {
        setToast({
          message: targetDocStatus === "DRAFT"
            ? `Draft invoice ${response.data.data.invoiceNo} saved successfully.`
            : `Invoice ${response.data.data.invoiceNo} confirmed and locked successfully.`,
          type: "success"
        });
        fetchInvoices();
        fetchDependencies();
        resetForm();
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to submit sales invoice.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmInvoice = async () => {
    if (!confirmModalInvoice) return;
    try {
      setActionLoading(true);
      const res = await api.post(`/api/invoice/${confirmModalInvoice.id}/confirm`);
      if (res.data && res.data.type === "success") {
        setToast({ message: `Invoice ${confirmModalInvoice.invoiceNo} confirmed and locked successfully.`, type: "success" });
        setConfirmModalInvoice(null);
        if (isDetailOpen && selectedInvoice?.id === confirmModalInvoice.id) {
          setIsDetailOpen(false);
        }
        fetchInvoices();
        fetchDependencies();
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to confirm invoice.", type: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteDraftInvoice = async () => {
    if (!deleteModalInvoice) return;
    try {
      setActionLoading(true);
      const res = await api.delete(`/api/invoice/${deleteModalInvoice.id}`);
      if (res.data && res.data.type === "success") {
        setToast({ message: `Draft invoice ${deleteModalInvoice.invoiceNo} deleted successfully.`, type: "success" });
        setDeleteModalInvoice(null);
        fetchInvoices();
        fetchDependencies();
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to delete draft invoice.", type: "error" });
    } finally {
      setActionLoading(false);
    }
  };

  const openDetail = async (invoice) => {
    try {
      const response = await api.get(`/api/invoice/${invoice.id}`);
      if (response.data && response.data.type === "success") {
        setSelectedInvoice(response.data.data);
        setIsDetailOpen(true);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load invoice receipt details.", type: "error" });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center">
            <Receipt className="mr-2 text-sky-600 dark:text-sky-400" /> Sales Invoices
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Generate and manage sales invoices, draft orders, and billing settlements.
          </p>
        </div>
        <button
          onClick={openCreateForm}
          className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 rounded-xl transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus size={16} className="mr-1.5" /> Raise New Invoice
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col md:flex-row gap-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Invoice No (e.g. INV-0001)..."
            value={searchNo}
            onChange={(e) => setSearchNo(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={docStatusFilter}
            onChange={(e) => setDocStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
          >
            <option value="all">All Documents</option>
            <option value="DRAFT">Drafts (Editable)</option>
            <option value="POSTED">Confirmed (Locked)</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
          >
            <option value="all">All Payment Status</option>
            <option value="PAID">Paid</option>
            <option value="PARTIALLY_PAID">Partially Paid</option>
            <option value="UNPAID">Unpaid</option>
          </select>
        </div>
      </div>

      {/* Invoice Creation / Edit Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-6xl w-full p-6 md:p-7 shadow-2xl space-y-6 my-6">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
                  <Receipt className="text-sky-600" size={22} />
                  {editingInvoiceId ? `Edit Draft Invoice: #${editingInvoiceNo}` : "Raise New Sales Invoice"}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {editingInvoiceId
                    ? "Modify draft line items, quantities, or discounts before confirming."
                    : "Enter line items, select discount mode (PKR / % / Per Piece), and save as draft or confirm."}
                </p>
              </div>
              <button
                type="button"
                onClick={resetForm}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); }} className="space-y-5">
              {/* Header Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Customer Account</label>
                  <select
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                  >
                    <option value="">Walk-In (Counter Cash)</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {Number(c.balance) < 0 ? `(Credit: Rs. ${formatCurrencyNoDecimals(Math.abs(c.balance))})` : `(Due: Rs. ${formatCurrencyNoDecimals(c.balance)})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Booker / Salesman</label>
                  <select
                    value={salesmanId}
                    onChange={(e) => setSalesmanId(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                  >
                    <option value="">Counter / No Salesman</option>
                    {salesmen.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Billing Type *</label>
                  <select
                    value={saleType}
                    onChange={(e) => setSaleType(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm font-semibold"
                  >
                    <option value="CASH">CASH (Paid at Counter)</option>
                    <option value="CREDIT">CREDIT (Customer Ledger)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 uppercase block mb-1">Notes / Narration</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Counter deal"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                  />
                </div>
              </div>

              {/* Line Items Container */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Cart Line Items</span>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 rounded-lg border border-sky-200 dark:border-sky-900/40 hover:bg-sky-100 transition-colors"
                  >
                    <Plus size={13} className="mr-1" /> Add Row
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, index) => {
                    const { lineDiscount, netRate, lineSubtotal } = computeRowValues(item);

                    return (
                      <div
                        key={index}
                        className="flex flex-col xl:flex-row xl:items-end gap-3 bg-slate-50/60 dark:bg-slate-900/40 p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 relative shadow-xs"
                      >
                        {/* Product Picker with Category Grouping & Prominent Size */}
                        <div className="flex-1 xl:min-w-[340px] relative">
                          <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1 tracking-wider">Product *</label>

                          {(() => {
                            const selectedProd = products.find(p => p.id === Number(item.productId));
                            if (selectedProd && openDropdownIndex !== index) {
                              return (
                                <div className="flex items-center justify-between px-3 py-2 bg-white dark:bg-slate-950 border border-sky-200 dark:border-sky-900/60 rounded-xl shadow-xs min-h-[44px]">
                                  <div className="min-w-0 pr-3">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-sm text-slate-900 dark:text-white">
                                        {selectedProd.name}
                                      </span>
                                      {selectedProd.size ? (
                                        <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-800 shadow-xs">
                                          Size: {selectedProd.size}
                                        </span>
                                      ) : (
                                        <span className="text-[10px] text-slate-400 italic">No Size</span>
                                      )}
                                      {selectedProd.category?.name && (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                          {selectedProd.category.name}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-1 flex gap-3">
                                      <span>Stock: <strong className="text-slate-700 dark:text-slate-300">{selectedProd.stockQuantity} pcs</strong></span>
                                      <span>Selling Rate: <strong className="text-slate-700 dark:text-slate-300">Rs. {formatCurrencyNoDecimals(selectedProd.sellingPrice)}</strong></span>
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenDropdownIndex(index);
                                      const nextQueries = [...searchQueries];
                                      nextQueries[index] = "";
                                      setSearchQueries(nextQueries);
                                    }}
                                    className="px-2.5 py-1 text-xs font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 rounded-lg transition-colors shrink-0 border border-sky-200 dark:border-sky-900/40"
                                  >
                                    Change
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <div className="relative">
                                <input
                                  type="text"
                                  required
                                  placeholder="Search by name, size, category..."
                                  value={searchQueries[index] || ""}
                                  onFocus={() => setOpenDropdownIndex(index)}
                                  onChange={(e) => {
                                    const query = e.target.value;
                                    const nextQueries = [...searchQueries];
                                    nextQueries[index] = query;
                                    setSearchQueries(nextQueries);
                                    setOpenDropdownIndex(index);

                                    if (!query.trim()) {
                                      handleItemChange(index, "productId", "");
                                    }
                                  }}
                                  className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-sm shadow-xs"
                                />

                                {openDropdownIndex === index && (
                                  <>
                                    <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownIndex(null)} />

                                    <div className="absolute left-0 right-0 mt-1 max-h-72 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-20 divide-y divide-slate-100 dark:divide-slate-800">
                                      {(() => {
                                        const q = (searchQueries[index] || "").toLowerCase().trim();
                                        const filtered = products.filter(p => {
                                          const cat = (p.category?.name || "").toLowerCase();
                                          const name = p.name.toLowerCase();
                                          const size = (p.size || "").toLowerCase();
                                          const sku = (p.sku || "").toLowerCase();
                                          const barcode = (p.barcode || "").toLowerCase();
                                          return name.includes(q) || size.includes(q) || cat.includes(q) || sku.includes(q) || barcode.includes(q);
                                        });

                                        if (filtered.length === 0) {
                                          return (
                                            <div className="px-4 py-3 text-xs text-slate-400 italic text-center">
                                              No matching products found
                                            </div>
                                          );
                                        }

                                        const grouped = {};
                                        for (const p of filtered) {
                                          const catName = p.category?.name || "Uncategorized";
                                          if (!grouped[catName]) grouped[catName] = [];
                                          grouped[catName].push(p);
                                        }

                                        return Object.entries(grouped).map(([catName, prodList]) => (
                                          <div key={catName} className="py-1">
                                            <div className="px-3 py-1 bg-slate-100/90 dark:bg-slate-800/90 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 sticky top-0 flex justify-between items-center z-10 backdrop-blur-xs">
                                              <span>{catName}</span>
                                              <span className="text-[9px] font-normal lowercase opacity-75">({prodList.length} items)</span>
                                            </div>
                                            {prodList.map((p) => (
                                              <button
                                                key={p.id}
                                                type="button"
                                                onClick={() => {
                                                  handleItemChange(index, "productId", p.id.toString());
                                                  const nextQueries = [...searchQueries];
                                                  nextQueries[index] = `${p.name}${p.size ? ` (${p.size})` : ""}`;
                                                  setSearchQueries(nextQueries);
                                                  setOpenDropdownIndex(null);
                                                }}
                                                className="w-full text-left px-3.5 py-2 text-xs hover:bg-sky-50 dark:hover:bg-sky-950/50 text-slate-700 dark:text-slate-200 transition-colors flex items-center justify-between group"
                                              >
                                                <div className="min-w-0 pr-2">
                                                  <div className="flex items-center gap-1.5">
                                                    <span className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-sky-600 dark:group-hover:text-sky-400">
                                                      {p.name}
                                                    </span>
                                                    {p.size ? (
                                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-200 dark:border-sky-800">
                                                        {p.size}
                                                      </span>
                                                    ) : (
                                                      <span className="text-[10px] text-slate-400 italic">No size</span>
                                                    )}
                                                  </div>
                                                  <div className="text-[10px] text-slate-400 mt-0.5 flex gap-2">
                                                    <span>Stock: <strong className="text-slate-600 dark:text-slate-300">{p.stockQuantity} pcs</strong></span>
                                                    {p.sku && <span>SKU: {p.sku}</span>}
                                                  </div>
                                                </div>
                                                <div className="text-right text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0">
                                                  Rs. {formatCurrencyNoDecimals(p.sellingPrice)}
                                                </div>
                                              </button>
                                            ))}
                                          </div>
                                        ));
                                      })()}
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })()}
                        </div>

                        {/* Qty */}
                        <div className="w-full sm:w-28">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Qty (pcs) *</label>
                          <input
                            type="number"
                            required
                            min="1"
                            placeholder="1"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm shadow-xs"
                          />
                        </div>

                        {/* Unit Selling Price */}
                        <div className="w-full sm:w-32">
                          <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Rate (PKR) *</label>
                          <input
                            type="number"
                            required
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            value={item.unitPrice}
                            onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm shadow-xs"
                          />
                        </div>

                        {/* Row-Level Discount with Type Selector */}
                        <div className="w-full sm:w-44">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[10px] font-semibold text-slate-400 uppercase">Discount</label>
                            <div className="flex bg-slate-200 dark:bg-slate-800 rounded-md p-0.5 text-[9px] font-bold">
                              <button
                                type="button"
                                onClick={() => handleItemChange(index, "discountType", "PKR")}
                                className={`px-1.5 py-0.5 rounded transition-colors ${item.discountType === "PKR" ? "bg-white dark:bg-slate-700 text-sky-600 shadow-xs" : "text-slate-500"}`}
                              >
                                PKR
                              </button>
                              <button
                                type="button"
                                onClick={() => handleItemChange(index, "discountType", "%")}
                                className={`px-1.5 py-0.5 rounded transition-colors ${item.discountType === "%" ? "bg-white dark:bg-slate-700 text-sky-600 shadow-xs" : "text-slate-500"}`}
                              >
                                %
                              </button>
                              <button
                                type="button"
                                onClick={() => handleItemChange(index, "discountType", "PER_PIECE")}
                                className={`px-1.5 py-0.5 rounded transition-colors ${item.discountType === "PER_PIECE" ? "bg-white dark:bg-slate-700 text-sky-600 shadow-xs" : "text-slate-500"}`}
                                title="Discount per piece"
                              >
                                /pc
                              </button>
                            </div>
                          </div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={item.discountValue}
                            onChange={(e) => handleItemChange(index, "discountValue", e.target.value)}
                            className="w-full px-3 py-2 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm shadow-xs"
                          />
                        </div>

                        {/* Real-time Net Rate & Line Subtotal */}
                        <div className="w-full sm:w-40 flex flex-col justify-end">
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="text-slate-400 font-semibold uppercase">Net Rate:</span>
                            <span className="font-extrabold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/60 px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-800/60">
                              Rs. {formatCurrency(netRate)}/pc
                            </span>
                          </div>
                          <div className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-xl text-sm text-slate-900 dark:text-white text-right font-bold select-none shadow-xs">
                            Rs. {formatCurrency(lineSubtotal)}
                          </div>
                        </div>

                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItemRow(index)}
                            className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-colors self-center lg:self-end mb-0.5"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Discount, Paid Amount, Applied Credit and Summary panel */}
              <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-col md:flex-row md:justify-between items-start md:items-end gap-4">
                <div className="flex flex-wrap gap-4">
                  {/* Header Invoice Discount */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block">Extra Disc</label>
                      <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 ml-2 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setDiscountType("PKR")}
                          className={`px-1.5 py-0.5 rounded-md transition-colors ${discountType === "PKR" ? "bg-white dark:bg-slate-700 text-sky-600 shadow-xs" : "text-slate-500"}`}
                        >
                          PKR
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiscountType("%")}
                          className={`px-1.5 py-0.5 rounded-md transition-colors ${discountType === "%" ? "bg-white dark:bg-slate-700 text-sky-600 shadow-xs" : "text-slate-500"}`}
                        >
                          %
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      className="w-32 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                    />
                  </div>

                  {/* Transport Discount */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block">Transport Disc</label>
                      <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 ml-2 text-[10px] font-bold">
                        <button
                          type="button"
                          onClick={() => setTransportDiscountType("PKR")}
                          className={`px-1.5 py-0.5 rounded-md transition-colors ${transportDiscountType === "PKR" ? "bg-white dark:bg-slate-700 text-sky-600 shadow-xs" : "text-slate-500"}`}
                        >
                          PKR
                        </button>
                        <button
                          type="button"
                          onClick={() => setTransportDiscountType("%")}
                          className={`px-1.5 py-0.5 rounded-md transition-colors ${transportDiscountType === "%" ? "bg-white dark:bg-slate-700 text-sky-600 shadow-xs" : "text-slate-500"}`}
                        >
                          %
                        </button>
                      </div>
                    </div>
                    <input
                      type="number"
                      value={transportDiscount}
                      onChange={(e) => setTransportDiscount(e.target.value)}
                      className="w-32 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                    />
                  </div>

                  {/* Paid Amount */}
                  <div>
                    <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Amount Paid (PKR)</label>
                    <input
                      type="number"
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      disabled={saleType === "CASH"}
                      className="w-36 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm disabled:opacity-50"
                    />
                  </div>

                  {/* Store Credit */}
                  {saleType === "CREDIT" && (
                    (() => {
                      const selectedCustomer = customers.find(c => c.id === Number(customerId));
                      const availableCredit = selectedCustomer && Number(selectedCustomer.balance) < 0 ? Math.abs(Number(selectedCustomer.balance)) : 0;
                      if (availableCredit > 0) {
                        return (
                          <div>
                            <label className="text-xs font-semibold text-amber-600 dark:text-amber-500 uppercase block mb-1">
                              Apply Store Credit (Max Rs. {formatCurrencyNoDecimals(availableCredit)})
                            </label>
                            <input
                              type="number"
                              min="0"
                              max={availableCredit}
                              value={creditApplied}
                              onChange={(e) => {
                                const val = Number(e.target.value) || 0;
                                if (val > availableCredit) {
                                  setCreditApplied(availableCredit.toString());
                                } else if (val < 0) {
                                  setCreditApplied("0");
                                } else {
                                  setCreditApplied(e.target.value);
                                }
                              }}
                              className="w-44 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-300 rounded-xl focus:ring-1 focus:ring-amber-500 outline-none text-sm font-semibold"
                            />
                          </div>
                        );
                      }
                      return null;
                    })()
                  )}
                </div>

                {/* Summary Box */}
                <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-right w-full md:w-80 space-y-1.5">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Gross Items Total:</span>
                    <span className="font-semibold">Rs. {formatCurrency(subtotal)}</span>
                  </div>
                  {Number(calculatedDiscountAmount) > 0 && (
                    <div className="flex justify-between text-xs text-rose-500">
                      <span>Header Discount:</span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        {discountType === "%"
                          ? `- ${Number(discount || 0)}% (Rs. ${formatCurrency(calculatedDiscountAmount)})`
                          : `- Rs. ${formatCurrency(Number(discount || 0))}`}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-slate-500 font-semibold border-t border-slate-200 dark:border-slate-800/40 pt-1.5">
                    <span>Running Total:</span>
                    <span className="text-slate-700 dark:text-slate-350">Rs. {formatCurrency(total)}</span>
                  </div>
                  {Number(calculatedTransportDiscountAmount) > 0 && (
                    <div className="flex justify-between text-xs text-amber-500">
                      <span>Transport Disc (Expense):</span>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {transportDiscountType === "%"
                          ? `- ${Number(transportDiscount || 0)}% (Rs. ${formatCurrency(calculatedTransportDiscountAmount)})`
                          : `- Rs. ${formatCurrency(Number(transportDiscount || 0))}`}
                      </span>
                    </div>
                  )}
                  {Number(creditApplied) > 0 && (
                    <div className="flex justify-between text-xs text-blue-500">
                      <span>Store Credit Applied:</span>
                      <span className="font-semibold">- Rs. {formatCurrency(Number(creditApplied))}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-xs text-slate-400 border-t border-slate-200 dark:border-slate-800/60 pt-1.5 font-bold">
                    <span>Net Payable Amount:</span>
                    <span className="text-sky-600 dark:text-sky-400 text-sm">Rs. {formatCurrency(netPayable)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Save as Draft vs Confirm & Post */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors order-2 sm:order-1"
                >
                  Cancel / Close
                </button>

                <div className="flex gap-2 w-full sm:w-auto order-1 sm:order-2">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleInvoiceSubmit("DRAFT")}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center px-4 py-2 text-xs font-bold text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 hover:bg-amber-200 dark:hover:bg-amber-900/60 rounded-xl transition-colors shadow-xs disabled:opacity-50"
                  >
                    <Edit3 size={14} className="mr-1.5" />
                    {editingInvoiceId ? "Save Draft Changes" : "Save as Draft (Editable)"}
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleInvoiceSubmit("POSTED")}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm disabled:opacity-50"
                  >
                    <Lock size={14} className="mr-1.5" />
                    {editingInvoiceId ? "Confirm & Lock Invoice" : "Confirm & Post (Locked)"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModalInvoice && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-900/40">
                <CheckCircle size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Confirm & Lock Invoice</h3>
                <p className="text-xs text-slate-500">{confirmModalInvoice.invoiceNo}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Are you sure you want to confirm this invoice?
              <br />
              <strong className="text-slate-900 dark:text-white block mt-1">
                Stock deductions, customer ledger debit, and general ledger entries will be permanently posted, and the invoice will become strictly immutable.
              </strong>
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setConfirmModalInvoice(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleConfirmInvoice}
                className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-xs disabled:opacity-50 inline-flex items-center"
              >
                <Lock size={14} className="mr-1.5" />
                {actionLoading ? "Confirming..." : "Yes, Confirm & Lock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Draft Modal */}
      {deleteModalInvoice && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-2.5 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900/40">
                <AlertTriangle size={24} />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white">Delete Draft Invoice</h3>
                <p className="text-xs text-slate-500">{deleteModalInvoice.invoiceNo}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to discard this draft invoice? This action cannot be undone.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setDeleteModalInvoice(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleDeleteDraftInvoice}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-colors shadow-xs disabled:opacity-50"
              >
                {actionLoading ? "Deleting..." : "Delete Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoices List Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden">
        {loading && invoices.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm animate-pulse">Loading sales history...</div>
        ) : invoices.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No sales invoices found matching criteria.</div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 dark:bg-slate-900/50">
                    <th className="px-6 py-4">Invoice No</th>
                    <th className="px-6 py-4">Doc Status</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Sold By</th>
                    <th className="px-6 py-4 text-center">Type</th>
                    <th className="px-6 py-4 text-right">Items</th>
                    <th className="px-6 py-4 text-right">Total</th>
                    {user?.role === "ADMIN" && <th className="px-6 py-4 text-right">Gross Profit</th>}
                    <th className="px-6 py-4 text-right">Received</th>
                    <th className="px-6 py-4 text-right">Remaining</th>
                    <th className="px-6 py-4 text-center">Payment</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                      <td className="px-6 py-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                        <div>{inv.invoiceNo}</div>
                        {inv.salesReturns && inv.salesReturns.length > 0 && (
                          <span className="inline-flex items-center mt-1.5 text-[9px] font-extrabold text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 px-1 rounded">
                            RETURNED
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4">
                        {inv.documentStatus === "DRAFT" ? (
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-50 text-amber-700 border border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                            <Edit3 size={10} className="mr-1" /> DRAFT
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                            <Lock size={10} className="mr-1" /> CONFIRMED
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                        <span className="flex items-center">
                          <Calendar size={12} className="mr-1.5" />
                          {new Date(inv.invoiceDate).toLocaleDateString()}
                        </span>
                      </td>

                      <td className="px-6 py-4 font-semibold capitalize text-slate-900 dark:text-white">
                        {inv.customer?.name || <span className="italic text-slate-400">Walk-In Counter</span>}
                      </td>

                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-semibold capitalize">
                        {inv.salesman?.name || <span className="text-slate-400 italic">N/A</span>}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${inv.saleType === "CREDIT"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400"
                          }`}>
                          {inv.saleType}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right font-semibold font-mono">
                        {inv.items?.reduce((sum, item) => sum + item.quantity, 0) || 0} pcs
                      </td>

                      <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                        Rs. {formatCurrency(inv.total)}
                      </td>

                      {user?.role === "ADMIN" && (
                        <td className="px-6 py-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          Rs. {formatCurrency(calculateInvoiceProfit(inv))}
                        </td>
                      )}

                      <td className="px-6 py-4 text-xs font-semibold text-slate-900 dark:text-white">
                        Rs. {formatCurrency(inv.paidAmount)}
                      </td>

                      <td className="px-6 py-4 text-xs font-semibold text-rose-600 dark:text-rose-400 font-bold">
                        Rs. {(() => {
                          const totalReturns = (inv.salesReturns || []).reduce((sum, ret) => sum + Number(ret.totalAmount || 0), 0);
                          const calBalanceDue = Math.max(
                            0,
                            Number(inv.total) -
                              Number(inv.transportDiscount || 0) -
                              Number(inv.paidAmount || 0) -
                              Number(inv.creditApplied || 0) -
                              totalReturns
                          );
                          return formatCurrency(calBalanceDue);
                        })()}
                      </td>

                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${inv.status === "PAID"
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/40"
                          : inv.status === "PARTIALLY_PAID"
                            ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-455 dark:border-amber-900/40"
                            : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-455 dark:border-rose-900/40"
                          }`}>
                          {inv.status.replace("_", " ")}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {inv.documentStatus === "DRAFT" ? (
                            <>
                              <button
                                onClick={() => openEditDraftForm(inv)}
                                title="Edit Draft"
                                className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 border border-amber-200 dark:border-amber-900/50 rounded-lg transition-colors"
                              >
                                <Edit3 size={12} className="mr-1" /> Edit
                              </button>

                              <button
                                onClick={() => setConfirmModalInvoice(inv)}
                                title="Confirm and Lock"
                                className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-900/50 rounded-lg transition-colors"
                              >
                                <CheckCircle size={12} className="mr-1" /> Confirm
                              </button>

                              <button
                                onClick={() => setDeleteModalInvoice(inv)}
                                title="Delete Draft"
                                className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg border border-transparent hover:border-rose-200 transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </>
                          ) : null}

                          <button
                            onClick={() => openDetail(inv)}
                            className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
                          >
                            <Eye size={12} className="mr-1" /> Receipt
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 p-4">
                <span className="text-xs text-slate-500">
                  Page {page} of {totalPages}
                </span>
                <div className="flex space-x-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page === totalPages}
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invoice Detail & Receipt Modal */}
      {isDetailOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full p-6 shadow-xl space-y-6 ${printFormat === "thermal" ? "max-w-sm thermal-receipt font-mono" : "max-w-2xl font-sans"}`}>
            {/* Header controls (no-print) */}
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 no-print">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white">POS Invoice Sheet</h3>
                {selectedInvoice.documentStatus === "DRAFT" ? (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-300">
                    DRAFT
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-300">
                    CONFIRMED
                  </span>
                )}
              </div>
              <div className="flex space-x-2 items-center">
                <select
                  value={printFormat}
                  onChange={(e) => setPrintFormat(e.target.value)}
                  className="px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg outline-none"
                >
                  <option value="a4">Standard A4</option>
                  <option value="thermal">Thermal 80mm</option>
                </select>
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 rounded-lg border border-sky-200 dark:border-sky-900/40 hover:bg-sky-100 transition-colors"
                >
                  <Printer size={12} className="mr-1.5" /> Print
                </button>
                <button
                  onClick={() => setIsDetailOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>

            {/* If Draft, show warning banner & confirm button */}
            {selectedInvoice.documentStatus === "DRAFT" && (
              <div className="no-print p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                  <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                  <span>
                    This is a <strong>DRAFT</strong> invoice. Stock and ledger entries are not yet posted.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmModalInvoice(selectedInvoice);
                  }}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors shadow-xs shrink-0"
                >
                  <CheckCircle size={13} className="mr-1" /> Confirm Invoice
                </button>
              </div>
            )}

            {/* Print Sheet Area */}
            {printFormat === "thermal" ? (
              <div className="thermal-receipt text-slate-900 dark:text-slate-100 space-y-4 print:text-black">
                <div className="text-center">
                  <h1 className="text-base font-extrabold tracking-wider">SAMEER DISTRIBUTORS</h1>
                  <p className="text-[10px] mt-0.5">FMCG Distribution Store</p>
                  <p className="text-[9px]">Phone: 03342320521</p>
                  <hr className="my-2 border-dashed border-slate-300 dark:border-slate-700 print:border-black" />
                  <p className="text-[10px] font-bold">
                    {selectedInvoice.documentStatus === "DRAFT" ? "[DRAFT] " : ""}RECEIPT: {selectedInvoice.invoiceNo}
                  </p>
                  <p className="text-[9px]">Date: {new Date(selectedInvoice.invoiceDate).toLocaleString()}</p>
                </div>

                <div className="text-[10px] space-y-0.5">
                  <p>Customer: <span className="font-bold capitalize">{selectedInvoice.customer?.name || "Walk-In counter"}</span></p>
                  {selectedInvoice.salesman && <p>Salesman: <span className="font-bold capitalize">{selectedInvoice.salesman.name}</span></p>}
                  {selectedInvoice.createdBy && <p>Operator: <span className="font-bold capitalize">{selectedInvoice.createdBy.name}</span></p>}
                  <p>Type: <span className="font-bold">{selectedInvoice.saleType}</span></p>
                </div>

                <hr className="border-dashed border-slate-300 dark:border-slate-700 print:border-black" />

                <table className="w-full text-left text-[9px] border-collapse">
                  <thead>
                    <tr className="border-b border-dashed border-slate-300 dark:border-slate-700 print:border-black font-bold">
                      <th className="pb-1">Item Description</th>
                      <th className="pb-1 text-right">Qty</th>
                      <th className="pb-1 text-right">Rate</th>
                      <th className="pb-1 text-right">Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="py-1 capitalize">{item.product?.name}{item.product?.size ? ` (${item.product.size})` : ""}</td>
                        <td className="py-1 text-right">{item.quantity}</td>
                        <td className="py-1 text-right">{formatCurrencyNoDecimals(item.unitPrice)}</td>
                        <td className="py-1 text-right font-bold">{formatCurrencyNoDecimals(item.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* POS Receipt Totals */}
                <div className="border-t border-dashed border-slate-300 dark:border-slate-700 print:border-black pt-1 space-y-0.5 text-[9px]">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>Rs. {formatCurrencyNoDecimals(selectedInvoice.subtotal)}</span>
                  </div>
                  {Number(selectedInvoice.discount) > 0 && (() => {
                    const discPct = Number(selectedInvoice.subtotal) > 0
                      ? ((Number(selectedInvoice.discount) / Number(selectedInvoice.subtotal)) * 100).toFixed(1)
                      : null;
                    return (
                      <div className="flex justify-between text-rose-500">
                        <span>Discount{discPct ? ` (${discPct}%)` : ''}:</span>
                        <span>-Rs. {formatCurrencyNoDecimals(selectedInvoice.discount)}</span>
                      </div>
                    );
                  })()}
                  {Number(selectedInvoice.transportDiscount) > 0 ? (
                    <>
                      <div className="flex justify-between font-bold border-t border-dashed border-slate-200 dark:border-slate-800 print:border-slate-300 pt-0.5">
                        <span>Running Total:</span>
                        <span>Rs. {formatCurrencyNoDecimals(selectedInvoice.total)}</span>
                      </div>
                      {(() => {
                        const transPct = Number(selectedInvoice.total) > 0
                          ? ((Number(selectedInvoice.transportDiscount) / Number(selectedInvoice.total)) * 100).toFixed(1)
                          : null;
                        return (
                          <div className="flex justify-between text-amber-600 dark:text-amber-500">
                            <span>Transport Disc{transPct ? ` (${transPct}%)` : ''}:</span>
                            <span>-Rs. {formatCurrencyNoDecimals(selectedInvoice.transportDiscount)}</span>
                          </div>
                        );
                      })()}
                      <div className="flex justify-between font-bold border-t border-dashed border-slate-200 dark:border-slate-800 print:border-slate-300 pt-0.5">
                        <span>Net Payable:</span>
                        <span>Rs. {formatCurrencyNoDecimals(Number(selectedInvoice.total) - Number(selectedInvoice.transportDiscount || 0))}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between font-bold border-t border-dashed border-slate-200 dark:border-slate-800 print:border-slate-300 pt-0.5">
                      <span>Grand Total:</span>
                      <span>Rs. {formatCurrencyNoDecimals(selectedInvoice.total)}</span>
                    </div>
                  )}
                  {Number(selectedInvoice.creditApplied) > 0 && (
                    <div className="flex justify-between">
                      <span>Store Credit:</span>
                      <span>Rs. {formatCurrencyNoDecimals(selectedInvoice.creditApplied)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Paid (Cash):</span>
                    <span>Rs. {formatCurrencyNoDecimals(selectedInvoice.paidAmount)}</span>
                  </div>
                  {selectedInvoiceCalculatedBalanceDue > 0 && (
                    <div className="flex justify-between text-rose-500 font-bold">
                      <span>Balance Due:</span>
                      <span>Rs. {formatCurrencyNoDecimals(selectedInvoiceCalculatedBalanceDue)}</span>
                    </div>
                  )}
                </div>

                <hr className="border-dashed border-slate-300 dark:border-slate-700 print:border-black" />

                <div className="text-center text-[9px] italic mt-2">
                  <p>Thank you for shopping with us!</p>
                  <p>Powered by Sameer Distributors</p>
                </div>
              </div>
            ) : (
              <div className="print-area text-slate-900 dark:text-slate-100 font-sans" style={{ fontSize: '12px' }}>
                {/* ===== COMPANY HEADER ===== */}
                <div className="border-b-2 border-slate-900 dark:border-slate-200 print:border-black" style={{ textAlign: 'center', paddingBottom: '10px', marginBottom: '12px' }}>
                  <h1 style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 2px 0', letterSpacing: '0.5px' }}>Sameer Distributors</h1>
                  <p className="text-slate-600 dark:text-slate-300 print:text-slate-800" style={{ fontSize: '11px', margin: '0' }}>Quetta, Pakistan &nbsp;|&nbsp; Contact: 03342320521</p>
                </div>

                {/* ===== INVOICE META ===== */}
                <div style={{ marginBottom: '12px', lineHeight: '1.8' }}>
                  <p style={{ margin: '0' }}>
                    <strong>Invoice No:</strong> {selectedInvoice.invoiceNo} {selectedInvoice.documentStatus === "DRAFT" ? "(DRAFT)" : ""}
                  </p>
                  <p style={{ margin: '0' }}><strong>Date:</strong> {new Date(selectedInvoice.invoiceDate).toISOString().split('T')[0]}</p>
                  {selectedInvoice.salesman && (
                    <p style={{ margin: '0' }}><strong>Booker:</strong> {selectedInvoice.salesman.name.toUpperCase()}</p>
                  )}
                  {selectedInvoice.createdBy && (
                    <p style={{ margin: '0' }}><strong>Operator:</strong> {selectedInvoice.createdBy.name.toUpperCase()}</p>
                  )}
                  <p style={{ margin: '0' }}><strong>Bill To:</strong> {(selectedInvoice.customer?.name || 'Counter Cash Customer').toUpperCase()}</p>
                  {selectedInvoice.customer?.address && (
                    <p style={{ margin: '0' }}><strong>Address:</strong> {selectedInvoice.customer.address.toUpperCase()}</p>
                  )}
                </div>

                {/* ===== ITEMS TABLE ===== */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', fontSize: '11px' }}>
                  <thead>
                    <tr className="bg-slate-100 dark:bg-slate-800 border-t border-b border-slate-900 dark:border-slate-200 print:border-black">
                      <th style={{ padding: '5px 6px', textAlign: 'left', fontWeight: '700' }} className="border-r border-slate-300 dark:border-slate-700 print:border-slate-300">Product ID</th>
                      <th style={{ padding: '5px 6px', textAlign: 'left', fontWeight: '700' }} className="border-r border-slate-300 dark:border-slate-700 print:border-slate-300">Item</th>
                      <th style={{ padding: '5px 6px', textAlign: 'right', fontWeight: '700' }} className="border-r border-slate-300 dark:border-slate-700 print:border-slate-300">TP Rate</th>
                      <th style={{ padding: '5px 6px', textAlign: 'right', fontWeight: '700' }} className="border-r border-slate-300 dark:border-slate-700 print:border-slate-300">Disc %</th>
                      <th style={{ padding: '5px 6px', textAlign: 'right', fontWeight: '700' }} className="border-r border-slate-300 dark:border-slate-700 print:border-slate-300">Disc Amt</th>
                      <th style={{ padding: '5px 6px', textAlign: 'right', fontWeight: '700' }} className="border-r border-slate-300 dark:border-slate-700 print:border-slate-300">Net Rate</th>
                      <th style={{ padding: '5px 6px', textAlign: 'right', fontWeight: '700' }} className="border-r border-slate-300 dark:border-slate-700 print:border-slate-300">Qty</th>
                      <th style={{ padding: '5px 6px', textAlign: 'right', fontWeight: '700' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.items?.map((item, idx) => {
                      const tpRate = Number(item.unitPrice);
                      const lineTotal = tpRate * item.quantity;
                      const discAmt = Math.max(0, lineTotal - Number(item.totalPrice));
                      const discPct = lineTotal > 0 ? (discAmt / lineTotal) * 100 : 0;
                      const netRate = Number(item.totalPrice) / (item.quantity || 1);
                      return (
                        <tr key={item.id || idx} className="border-b border-slate-200 dark:border-slate-800 print:border-slate-200">
                          <td style={{ padding: '5px 6px', fontWeight: '600' }} className="border-r border-slate-200 dark:border-slate-800 print:border-slate-200">{String(idx + 1).padStart(3, '0')}</td>
                          <td style={{ padding: '5px 6px', textTransform: 'uppercase', fontWeight: '500' }} className="border-r border-slate-200 dark:border-slate-800 print:border-slate-200">{item.product?.name}{item.product?.size ? ` (${item.product.size})` : ""}</td>
                          <td style={{ padding: '5px 6px', textAlign: 'right' }} className="border-r border-slate-200 dark:border-slate-800 print:border-slate-200">{formatCurrency(tpRate)}</td>
                          <td style={{ padding: '5px 6px', textAlign: 'right' }} className="border-r border-slate-200 dark:border-slate-800 print:border-slate-200">{discAmt > 0 ? `${discPct.toFixed(0)}%` : '0%'}</td>
                          <td style={{ padding: '5px 6px', textAlign: 'right' }} className="border-r border-slate-200 dark:border-slate-800 print:border-slate-200">{formatCurrency(discAmt)}</td>
                          <td style={{ padding: '5px 6px', textAlign: 'right' }} className="border-r border-slate-200 dark:border-slate-800 print:border-slate-200">{formatCurrency(netRate)}</td>
                          <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: '600' }} className="border-r border-slate-200 dark:border-slate-800 print:border-slate-200">{item.quantity}</td>
                          <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: '700' }}>{formatCurrency(lineTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* ===== SUMMARY SECTION ===== */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                  <div style={{ minWidth: '300px', fontSize: '12px' }}>
                    <div className="border-t border-slate-300 dark:border-slate-700 print:border-slate-300" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span>Items Subtotal:</span>
                      <span style={{ fontWeight: '700' }}>PKR {formatCurrency(Number(selectedInvoice.subtotal))}</span>
                    </div>
                    {Number(selectedInvoice.discount) > 0 && (() => {
                      const discPct = Number(selectedInvoice.subtotal) > 0
                        ? ((Number(selectedInvoice.discount) / Number(selectedInvoice.subtotal)) * 100).toFixed(1)
                        : null;
                      return (
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span>Invoice Discount{discPct ? ` (${discPct}%)` : ''}:</span>
                          <span style={{ fontWeight: '600' }}>PKR {formatCurrency(Number(selectedInvoice.discount || 0))}</span>
                        </div>
                      );
                    })()}
                    {Number(selectedInvoice.transportDiscount) > 0 ? (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                          <span>Running Total:</span>
                          <span style={{ fontWeight: '600' }}>PKR {formatCurrency(Number(selectedInvoice.total))}</span>
                        </div>
                        {(() => {
                          const transPct = Number(selectedInvoice.total) > 0
                            ? ((Number(selectedInvoice.transportDiscount) / Number(selectedInvoice.total)) * 100).toFixed(1)
                            : null;
                          return (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#d97706' }}>
                              <span>Transport Disc{transPct ? ` (${transPct}%)` : ''}:</span>
                              <span style={{ fontWeight: '600' }}>PKR {formatCurrency(Number(selectedInvoice.transportDiscount || 0))}</span>
                            </div>
                          );
                        })()}
                        <div className="border-t-2 border-slate-900 dark:border-slate-200 print:border-black" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', marginTop: '4px' }}>
                          <span style={{ fontWeight: '800', fontSize: '13px' }}>NET PAYABLE AMOUNT:</span>
                          <span style={{ fontWeight: '900', fontSize: '13px' }}>PKR {formatCurrency(Number(selectedInvoice.total) - Number(selectedInvoice.transportDiscount || 0))}</span>
                        </div>
                      </>
                    ) : (
                      <div className="border-t-2 border-slate-900 dark:border-slate-200 print:border-black" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', marginTop: '4px' }}>
                        <span style={{ fontWeight: '800', fontSize: '13px' }}>NET TOTAL AMOUNT:</span>
                        <span style={{ fontWeight: '900', fontSize: '13px' }}>PKR {formatCurrency(Number(selectedInvoice.total))}</span>
                      </div>
                    )}
                    {Number(selectedInvoice.creditApplied) > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#3b82f6' }}>
                        <span>Store Credit Applied:</span>
                        <span style={{ fontWeight: '600' }}>- PKR {formatCurrency(selectedInvoice.creditApplied)}</span>
                      </div>
                    )}
                    {selectedInvoiceTotalReturns > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#f43f5e' }}>
                        <span>Returned Value:</span>
                        <span style={{ fontWeight: '600' }}>- PKR {formatCurrency(selectedInvoiceTotalReturns)}</span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#16a34a' }}>
                      <span>Amount Received (Cash):</span>
                      <span style={{ fontWeight: '600' }}>PKR {formatCurrency(selectedInvoice.paidAmount)}</span>
                    </div>
                    {selectedInvoiceCalculatedBalanceDue > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#dc2626', fontWeight: '700' }}>
                        <span>Balance Due:</span>
                        <span>PKR {formatCurrency(selectedInvoiceCalculatedBalanceDue)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ===== ASSOCIATED RETURNS ===== */}
                {selectedInvoice.salesReturns && selectedInvoice.salesReturns.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-slate-800 print:border-slate-250" style={{ marginTop: '12px', paddingTop: '8px', fontSize: '11px' }}>
                    <span className="font-bold text-rose-600 dark:text-rose-450 block mb-1">Associated Returns:</span>
                    <div style={{ paddingLeft: '4px' }} className="space-y-1 text-slate-600 dark:text-slate-400 font-mono text-[10px]">
                      {selectedInvoice.salesReturns.map((ret) => (
                        <div key={ret.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>{ret.returnNo}</span>
                          <span className="font-bold">Rs. {formatCurrency(ret.totalAmount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ===== FOOTER NOTES ===== */}
                {selectedInvoice.description && (
                  <div className="border-t border-slate-200 dark:border-slate-800 print:border-slate-200 text-slate-500 dark:text-slate-400" style={{ marginTop: '12px', paddingTop: '6px', fontSize: '11px', fontStyle: 'italic' }}>
                    Notes: {selectedInvoice.description}
                  </div>
                )}

                <div className="border-t border-dashed border-slate-300 dark:border-slate-700 print:border-slate-300 text-slate-400" style={{ textAlign: 'center', marginTop: '16px', fontSize: '10px', paddingTop: '8px' }}>
                  Thank you for your business! | Sameer Distributors | 03342320521
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Invoices;
