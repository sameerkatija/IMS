import React, { useState, useEffect } from "react";
import api from "../services/api";
import { Receipt, Plus, Search, Eye, Printer, Trash2, Calendar, User, UserCheck } from "lucide-react";
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

  // Create Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
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
  const [items, setItems] = useState([{ productId: "", quantity: "", unitPrice: "", discount: "0" }]);
  const [submitting, setSubmitting] = useState(false);

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
  }, [page, searchNo, statusFilter]);

  useEffect(() => {
    fetchDependencies();
  }, []);

  const addItemRow = () => {
    setItems([...items, { productId: "", quantity: "", unitPrice: "", discount: "0" }]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    if (field === "productId" && value) {
      const selectedProd = products.find(p => p.id === Number(value));
      if (selectedProd) {
        updated[index].unitPrice = selectedProd.sellingPrice.toString();
        // Warn if stock is 0 or low
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

  // Totals calculations
  const subtotal = items.reduce((acc, curr) => {
    const qty = Number(curr.quantity) || 0;
    const price = Number(curr.unitPrice) || 0;
    const disc = Number(curr.discount) || 0;
    return acc + Math.max(0, (qty * price) - disc);
  }, 0);

  const calculatedDiscountAmount = discountType === "%"
    ? (subtotal * (Number(discount) || 0)) / 100
    : (Number(discount) || 0);

  const total = Math.max(0, subtotal - calculatedDiscountAmount); // This is the Running Total after standard discount

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
      setPaidAmount("0");
    }
  }, [saleType, netPayable]);

  const handleInvoiceSubmit = async (e) => {
    e.preventDefault();
    if (saleType === "CREDIT" && !customerId) {
      setToast({ message: "A registered customer account is required for credit sales.", type: "error" });
      return;
    }

    const validItems = items.filter(it => it.productId && Number(it.quantity) > 0 && Number(it.unitPrice) >= 0);
    if (validItems.length === 0) {
      setToast({ message: "Invoice must contain at least one valid item.", type: "error" });
      return;
    }

    // Verify stock availability and check cost price restraint
    let totalCost = 0;
    for (let it of validItems) {
      const p = products.find(prod => prod.id === Number(it.productId));
      if (p) {
        if (Number(it.quantity) > p.stockQuantity) {
          setToast({ message: `Cannot sell ${it.quantity} pieces of ${p.name}. Only ${p.stockQuantity} available.`, type: "error" });
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
        description: description || null,
        items: validItems.map(it => ({
          productId: Number(it.productId),
          quantity: Number(it.quantity),
          unitPrice: Number(it.unitPrice),
          discount: Number(it.discount) || 0
        }))
      };

      const response = await api.post("/api/invoice", payload);
      if (response.data && response.data.type === "success") {
        setToast({ message: `Invoice ${response.data.data.invoiceNo} created successfully.`, type: "success" });
        fetchInvoices();
        // Re-pull products list to sync stock quantities immediately
        fetchDependencies();

        // Reset form
        setCustomerId("");
        setSalesmanId("");
        setSaleType("CASH");
        setDiscount("0");
        setDiscountType("PKR");
        setTransportDiscount("0");
        setTransportDiscountType("%");
        setPaidAmount("0");
        setCreditApplied("0");
        setDescription("");
        setItems([{ productId: "", quantity: "", unitPrice: "" }]);
        setIsFormOpen(false);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to submit sales invoice.", type: "error" });
    } finally {
      setSubmitting(false);
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
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 dark:border-slate-800 pb-5 gap-4 no-print">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Point of Sale (POS)</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Generate invoices, process cash/credit sales, and allocate salesmen tags.
          </p>
        </div>
        {!isFormOpen ? (
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 active:scale-95 transition-all duration-150"
          >
            <Plus size={16} className="mr-2" /> Create POS Invoice
          </button>
        ) : (
          <button
            onClick={() => {
              setIsFormOpen(false);
              setCustomerId("");
              setSalesmanId("");
              setSaleType("CASH");
              setDiscount("0");
              setPaidAmount("0");
              setCreditApplied("0");
              setDescription("");
              setItems([{ productId: "", quantity: "", unitPrice: "" }]);
            }}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-sm font-semibold rounded-xl active:scale-95 transition-all duration-150"
          >
            Back to Sales Log
          </button>
        )}
      </div>

      {isFormOpen ? (
        /* Create Invoice View */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm max-w-5xl mx-auto no-print">
          <h2 className="text-lg font-bold mb-4">New Sales Transaction</h2>

          <form onSubmit={handleInvoiceSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Sale Type *</label>
                <select
                  value={saleType}
                  onChange={(e) => setSaleType(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm font-bold"
                >
                  <option value="CASH">CASH SALE</option>
                  <option value="CREDIT">CREDIT ACCOUNT</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Customer Account</label>
                <select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  disabled={saleType === "CASH" && customers.length === 0}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm disabled:opacity-50"
                >
                  <option value="">{saleType === "CASH" ? "Walk-in Counter Customer" : "Select Credit Account..."}</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} (Bal: Rs. {formatCurrencyNoDecimals(c.balance)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Salesman Credit Tag</label>
                <select
                  value={salesmanId}
                  onChange={(e) => setSalesmanId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                >
                  <option value="">None / Direct Sale</option>
                  {salesmen.map((sm) => (
                    <option key={sm.id} value={sm.id}>{sm.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Internal Notes</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Counter deal"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Cart Line Items</span>
                <button
                  type="button"
                  onClick={addItemRow}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 rounded-lg border border-sky-200 dark:border-sky-900/40 hover:bg-sky-100 transition-colors"
                >
                  <Plus size={12} className="mr-1" /> Add Row
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => {
                  const currentProd = products.find(p => p.id === Number(item.productId));
                  const stockMax = currentProd ? currentProd.stockQuantity : 0;
                  return (
                    <div key={index} className="flex flex-col md:flex-row md:items-end gap-3 bg-slate-50/50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                      <div className="flex-1">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Product Lookup *</label>
                        <select
                          required
                          value={item.productId}
                          onChange={(e) => handleItemChange(index, "productId", e.target.value)}
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                        >
                          <option value="">Select Item...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}{p.size ? ` (${p.size})` : ""} (Stock: {p.stockQuantity} pcs) [Rs. {formatCurrencyNoDecimals(p.sellingPrice)}]
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-full md:w-32">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Qty (pieces) *</label>
                        <input
                          type="number"
                          required
                          min="1"
                          max={stockMax}
                          placeholder="0"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                        />
                      </div>

                      <div className="w-full md:w-36">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Selling Price *</label>
                        <input
                          type="number"
                          required
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)}
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                        />
                      </div>

                      <div className="w-full md:w-32">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Discount (PKR)</label>
                        <input
                          type="number"
                          min="0"
                          placeholder="0.00"
                          value={item.discount}
                          onChange={(e) => handleItemChange(index, "discount", e.target.value)}
                          className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                        />
                      </div>

                      <div className="w-full md:w-36">
                        <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Subtotal</label>
                        <div className="w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-850 rounded-lg text-sm text-slate-500 text-right font-semibold select-none">
                          Rs. {formatCurrency(Math.max(0, (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0) - (Number(item.discount) || 0)))}
                        </div>
                      </div>

                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeItemRow(index)}
                          className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition-colors self-center md:self-end mb-0.5"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Calculations and payment options */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-col md:flex-row md:justify-between items-end gap-4">
              <div className="flex gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block">Discount</label>
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 ml-2 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setDiscountType("PKR")}
                        className={`px-1.5 py-0.5 rounded-md transition-colors ${discountType === "PKR" ? "bg-white dark:bg-slate-700 text-sky-600 shadow-sm" : "text-slate-500"}`}
                      >
                        PKR
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType("%")}
                        className={`px-1.5 py-0.5 rounded-md transition-colors ${discountType === "%" ? "bg-white dark:bg-slate-700 text-sky-600 shadow-sm" : "text-slate-500"}`}
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

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block">Transport Disc</label>
                    <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 ml-2 text-[10px] font-bold">
                      <button
                        type="button"
                        onClick={() => setTransportDiscountType("PKR")}
                        className={`px-1.5 py-0.5 rounded-md transition-colors ${transportDiscountType === "PKR" ? "bg-white dark:bg-slate-700 text-sky-600 shadow-sm" : "text-slate-500"}`}
                      >
                        PKR
                      </button>
                      <button
                        type="button"
                        onClick={() => setTransportDiscountType("%")}
                        className={`px-1.5 py-0.5 rounded-md transition-colors ${transportDiscountType === "%" ? "bg-white dark:bg-slate-700 text-sky-600 shadow-sm" : "text-slate-500"}`}
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

              <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-right w-full md:w-80 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Gross Invoice Total:</span>
                  <span className="font-semibold">Rs. {formatCurrency(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-rose-500">
                  <span>Invoice Discount:</span>
                  <span className="font-semibold text-rose-600 dark:text-rose-400">
                    {discountType === "%"
                      ? `- ${Number(discount || 0)}% (Rs. ${formatCurrency(calculatedDiscountAmount)})`
                      : `- Rs. ${formatCurrency(Number(discount || 0))}`}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 font-semibold border-t border-slate-200 dark:border-slate-800/40 pt-1.5">
                  <span>Running Total:</span>
                  <span className="text-slate-700 dark:text-slate-350">Rs. {formatCurrency(total)}</span>
                </div>
                <div className="flex justify-between text-xs text-amber-500">
                  <span>Transport Disc (Expense):</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">
                    {transportDiscountType === "%"
                      ? `- ${Number(transportDiscount || 0)}% (Rs. ${formatCurrency(calculatedTransportDiscountAmount)})`
                      : `- Rs. ${formatCurrency(Number(transportDiscount || 0))}`}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-blue-500">
                  <span>Store Credit Applied:</span>
                  <span className="font-semibold">- Rs. {formatCurrency(Number(creditApplied))}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400 border-t border-slate-200 dark:border-slate-800/60 pt-1.5 font-bold">
                  <span>Net Payable Amount:</span>
                  <span className="text-sky-600 dark:text-sky-400">Rs. {formatCurrency(netPayable)}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Balance Due:</span>
                  <span>Rs. {formatCurrency(Math.max(0, netPayable - (Number(paidAmount) || 0) - (Number(creditApplied) || 0)))}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 border-t border-slate-200 dark:border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-5 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center px-5 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md shadow-sky-500/20 disabled:bg-sky-850 transition-colors"
              >
                {submitting ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                ) : (
                  <Receipt size={16} className="mr-2" />
                )}
                Finalize Sale
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* History Log View */
        <div className="space-y-4 no-print">
          {/* History Search Panels */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center">
            <div className="w-full md:w-72 flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
              <Search className="text-slate-400 mr-2 flex-shrink-0" size={16} />
              <input
                type="text"
                placeholder="Search Invoice #..."
                value={searchNo}
                onChange={(e) => { setSearchNo(e.target.value); setPage(1); }}
                className="w-full text-sm bg-transparent outline-none border-none focus:ring-0 placeholder-slate-400"
              />
            </div>

            <div className="w-full md:w-48 flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                className="w-full text-sm bg-transparent border-none outline-none focus:ring-0 text-slate-700 dark:text-slate-300"
              >
                <option value="all">All Settlements</option>
                <option value="UNPAID">Unpaid Invoices</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Paid Invoices</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : invoices.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <Receipt className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={40} />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No invoices generated</h3>
              <p className="text-sm text-slate-400 mt-1">Transactions logged in POS will populate here.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        <th className="px-6 py-4">Invoice No</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Customer</th>
                        <th className="px-6 py-4">Sold By</th>
                        <th className="px-6 py-4 text-center">Sale Type</th>
                        <th className="px-6 py-4 text-right">Items Sold</th>
                        <th className="px-6 py-4 text-right">Invoice Total</th>
                        {user?.role === "ADMIN" && <th className="px-6 py-4 text-right">Gross Profit</th>}
                        <th className="px-6 py-4 text-right">Received</th>
                        <th className="px-6 py-4 text-right">Remaining</th>
                        <th className="px-6 py-4 text-center">Settlement</th>
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
                            <button
                              onClick={() => openDetail(inv)}
                              className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
                            >
                              <Eye size={12} className="mr-1" /> Receipt
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
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
      )}

      {/* Invoice Detail & Receipt Modal */}
      {isDetailOpen && selectedInvoice && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full p-6 shadow-xl space-y-6 ${printFormat === "thermal" ? "max-w-sm thermal-receipt font-mono" : "max-w-2xl font-sans"
            }`}>
            {/* Header controls (no-print) */}
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 no-print">
              <h3 className="font-bold text-slate-900 dark:text-white">POS Invoice Sheet</h3>
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

            {/* Print Sheet Area */}
            {printFormat === "thermal" ? (
              /* THERMAL ROLL 80MM LAYOUT */
              <div className="thermal-receipt text-slate-900 dark:text-slate-100 space-y-4 print:text-black">
                <div className="text-center">
                  <h1 className="text-base font-extrabold tracking-wider">SAMEER DISTRIBUTORS</h1>
                  <p className="text-[10px] mt-0.5">FMCG Distribution Store</p>
                  <p className="text-[9px]">Phone: 03342320521</p>
                  <hr className="my-2 border-dashed border-slate-300 dark:border-slate-700 print:border-black" />
                  <p className="text-[10px] font-bold">RECEIPT: {selectedInvoice.invoiceNo}</p>
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
                  <p style={{ margin: '0' }}><strong>Invoice No:</strong> {selectedInvoice.invoiceNo}</p>
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
