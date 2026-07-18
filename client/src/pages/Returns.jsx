import React, { useState, useEffect } from "react";
import api from "../services/api";
import { RotateCcw, Plus, Calendar, ArrowRight, Clipboard, Trash2, ArrowLeftRight, Check, ShieldAlert, Eye, Printer } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Toast from "../components/Toast";

const Returns = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("sales");
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [selectedReturnDetail, setSelectedReturnDetail] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailType, setDetailType] = useState(""); // "sales" or "purchase"
  const [submitting, setSubmitting] = useState(false);

  // Tab 1: Manual Adjustments
  const [movements, setMovements] = useState([]);
  const [movementsPage, setMovementsPage] = useState(1);
  const [movementsTotalPages, setMovementsTotalPages] = useState(1);
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [adjForm, setAdjForm] = useState({
    productId: "",
    quantity: "", // positive or negative
    reason: "Damaged",
    description: "",
    secretKey: ""
  });

  // Tab 2: Sales Returns (Customer)
  const [salesReturns, setSalesReturns] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [isSalesReturnFormOpen, setIsSalesReturnFormOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [loadedInvoice, setLoadedInvoice] = useState(null);
  const [salesReturnItems, setSalesReturnItems] = useState([]); // [{productId, name, sku, maxQty, quantity, unitPrice}]
  const [salesReturnReason, setSalesReturnReason] = useState("");
  const [salesReturnRefundType, setSalesReturnRefundType] = useState("CREDIT");

  // Tab 3: Purchase Returns (Supplier)
  const [purchaseReturns, setPurchaseReturns] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [isPurchaseReturnFormOpen, setIsPurchaseReturnFormOpen] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState("");
  const [loadedPurchase, setLoadedPurchase] = useState(null);
  const [purchaseReturnItems, setPurchaseReturnItems] = useState([]); // [{productId, name, sku, maxQty, quantity, unitCost}]
  const [purchaseReturnReason, setPurchaseReturnReason] = useState("");

  const fetchProducts = async () => {
    try {
      const response = await api.get("/api/product?limit=100&isActive=true");
      if (response.data && response.data.type === "success") {
        setProducts(response.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMovements = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/stock/movements?page=${movementsPage}&limit=10`);
      if (response.data && response.data.type === "success") {
        setMovements(response.data.data);
        setMovementsTotalPages(response.data.pagination?.totalPages || 1);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load movements log.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesReturns = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/sales-return");
      if (response.data) {
        setSalesReturns(response.data.data || response.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseReturns = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/purchase-return");
      if (response.data) {
        setPurchaseReturns(response.data.data || response.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoicesList = async () => {
    try {
      const response = await api.get("/api/invoice?limit=100");
      if (response.data && response.data.type === "success") {
        setInvoices(response.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPurchasesList = async () => {
    try {
      const response = await api.get("/api/purchase?limit=100");
      if (response.data && response.data.type === "success") {
        setPurchases(response.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    if (activeTab === "adjustments") {
      fetchMovements();
    } else if (activeTab === "sales") {
      fetchSalesReturns();
      fetchInvoicesList();
    } else if (activeTab === "purchase") {
      fetchPurchaseReturns();
      fetchPurchasesList();
    }
  }, [activeTab, movementsPage]);

  const openReturnDetail = async (id, type) => {
    try {
      setLoading(true);
      const response = await api.get(`/api/${type}-return/${id}`);
      if (response.data && response.data.type === "success") {
        setSelectedReturnDetail(response.data.data);
        setDetailType(type);
        setIsDetailOpen(true);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load return details.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Tab 1: Adjustment Submission
  const handleAdjSubmit = async (e) => {
    e.preventDefault();
    if (!adjForm.productId || !adjForm.quantity || Number(adjForm.quantity) === 0) {
      setToast({ message: "Please fill all required fields correctly.", type: "error" });
      return;
    }

    try {
      setSubmitting(true);
      let finalQty = Number(adjForm.quantity);

      if (adjForm.reason === "Damaged" || adjForm.reason === "Expired") {
        if (finalQty <= 0) {
          setToast({ message: "Please enter a positive number. Stock reduction is automatically handled for Damaged/Expired reasons.", type: "error" });
          setSubmitting(false);
          return;
        }
        // Deduct quantity automatically
        finalQty = -finalQty;
      }

      const payload = {
        productId: Number(adjForm.productId),
        quantity: finalQty,
        reason: adjForm.reason,
        description: adjForm.description || null,
        secretKey: adjForm.secretKey
      };

      const response = await api.post("/api/stock/adjustments", payload);
      if (response.data && response.data.type === "success") {
        setToast({ message: "Stock manual adjustment processed successfully.", type: "success" });
        fetchMovements();
        setIsAdjModalOpen(false);
        setAdjForm({ productId: "", quantity: "", reason: "Damaged", description: "", secretKey: "" });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to process adjustment.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Tab 2: Load Invoice Items for Return
  const handleInvoiceSelect = async (id) => {
    setSelectedInvoiceId(id);
    if (!id) {
      setLoadedInvoice(null);
      setSalesReturnItems([]);
      return;
    }

    try {
      const response = await api.get(`/api/invoice/${id}`);
      if (response.data && response.data.type === "success") {
        const inv = response.data.data;
        setLoadedInvoice(inv);
        setSalesReturnItems(inv.items.map(it => ({
          productId: it.productId,
          name: it.product.name + (it.product.size ? ` (${it.product.size})` : ""),
          sku: it.product.sku || "",
          maxQty: it.quantity,
          quantity: 0,
          unitPrice: Number(it.unitPrice)
        })));
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load invoice items.", type: "error" });
    }
  };

  const handleSalesReturnItemQtyChange = (index, val) => {
    const updated = [...salesReturnItems];
    const item = updated[index];
    const inputVal = Math.min(item.maxQty, Math.max(0, Number(val) || 0));
    item.quantity = inputVal;
    setSalesReturnItems(updated);
  };

  const handleSalesReturnSubmit = async (e) => {
    e.preventDefault();
    const itemsToReturn = salesReturnItems.filter(it => it.quantity > 0);
    if (itemsToReturn.length === 0) {
      setToast({ message: "Please enter returned quantity for at least one item.", type: "error" });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        customerId: loadedInvoice.customerId || null,
        invoiceId: loadedInvoice.id,
        reason: salesReturnReason || null,
        refundType: salesReturnRefundType,
        items: itemsToReturn.map(it => ({
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice
        }))
      };

      const response = await api.post("/api/sales-return", payload);
      if (response.data) {
        setToast({ message: "Sales return registered successfully.", type: "success" });
        fetchSalesReturns();
        setIsSalesReturnFormOpen(false);
        setLoadedInvoice(null);
        setSelectedInvoiceId("");
        setSalesReturnItems([]);
        setSalesReturnReason("");
        setSalesReturnRefundType("CREDIT");
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to process sales return.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  // Tab 3: Load Purchase Items for Return
  const handlePurchaseSelect = async (id) => {
    setSelectedPurchaseId(id);
    if (!id) {
      setLoadedPurchase(null);
      setPurchaseReturnItems([]);
      return;
    }

    try {
      const response = await api.get(`/api/purchase/${id}`);
      if (response.data && response.data.type === "success") {
        const purchaseItem = response.data.data;
        setLoadedPurchase(purchaseItem);
        setPurchaseReturnItems(purchaseItem.items.map(it => ({
          productId: it.productId,
          name: (it.product?.name || "Product #" + it.productId) + (it.product?.size ? ` (${it.product.size})` : ""),
          sku: it.product?.sku || "",
          maxQty: it.quantity,
          quantity: 0,
          unitCost: Number(it.unitCost)
        })));
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load purchase items.", type: "error" });
    }
  };

  const handlePurchaseReturnItemQtyChange = (index, val) => {
    const updated = [...purchaseReturnItems];
    const item = updated[index];
    const inputVal = Math.min(item.maxQty, Math.max(0, Number(val) || 0));
    item.quantity = inputVal;
    setPurchaseReturnItems(updated);
  };

  const handlePurchaseReturnSubmit = async (e) => {
    e.preventDefault();
    const itemsToReturn = purchaseReturnItems.filter(it => it.quantity > 0);
    if (itemsToReturn.length === 0) {
      setToast({ message: "Please enter returned quantity for at least one item.", type: "error" });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        supplierId: loadedPurchase.supplierId,
        purchaseId: loadedPurchase.id,
        reason: purchaseReturnReason || null,
        items: itemsToReturn.map(it => ({
          productId: it.productId,
          quantity: it.quantity,
          unitCost: it.unitCost
        }))
      };

      const response = await api.post("/api/purchase-return", payload);
      if (response.data) {
        setToast({ message: "Purchase return registered successfully.", type: "success" });
        fetchPurchaseReturns();
        setIsPurchaseReturnFormOpen(false);
        setLoadedPurchase(null);
        setSelectedPurchaseId("");
        setPurchaseReturnItems([]);
        setPurchaseReturnReason("");
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to process purchase return.", type: "error" });
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

      {/* Tabs list */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-8 text-sm font-medium">
          <button
            onClick={() => { setActiveTab("sales"); }}
            className={`py-4 border-b-2 px-1 transition-all ${
              activeTab === "sales"
                ? "border-sky-600 text-sky-600 dark:text-sky-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Sales Returns
          </button>
          <button
            onClick={() => { setActiveTab("purchase"); }}
            className={`py-4 border-b-2 px-1 transition-all ${
              activeTab === "purchase"
                ? "border-sky-600 text-sky-600 dark:text-sky-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Purchase Returns
          </button>
          <button
            onClick={() => { setActiveTab("adjustments"); }}
            className={`py-4 border-b-2 px-1 transition-all ${
              activeTab === "adjustments"
                ? "border-sky-600 text-sky-600 dark:text-sky-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Manual Adjustments
          </button>
        </nav>
      </div>

      {activeTab === "adjustments" && (
        /* MANUAL STOCK ADJUSTMENTS TAB */
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Manual Adjustments & Audit Logs</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                View permanent audit trails of all inventory inflows/outflows.
              </p>
            </div>
            {user?.role === "ADMIN" && (
              <button
                onClick={() => {
                  const confirmed = window.confirm("⚠️ WARNING: Manual stock adjustments directly override physical inventory counts and modify profit/loss reports. Are you absolutely sure you want to proceed?");
                  if (confirmed) setIsAdjModalOpen(true);
                }}
                className="inline-flex items-center justify-center px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 transition-all duration-150"
              >
                <Plus size={16} className="mr-2" /> Log Stock Correction
              </button>
            )}
          </div>

          {loading && movements.length === 0 ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : movements.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <ArrowLeftRight className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={40} />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No stock movements recorded</h3>
              <p className="text-sm text-slate-400 mt-1">Actions on sales or purchases automatically build this ledger.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        <th className="px-6 py-4">Timestamp</th>
                        <th className="px-6 py-4">Product Name</th>
                        <th className="px-6 py-4 text-center">Direction</th>
                        <th className="px-6 py-4 text-right">Quantity</th>
                        <th className="px-6 py-4">Reference Source</th>
                        <th className="px-6 py-4">Description / Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                      {movements.map((mv) => (
                        <tr key={mv.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                            <span className="flex items-center">
                              <Calendar size={12} className="mr-1.5" />
                              {new Date(mv.createdAt).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-950 dark:text-white capitalize">
                            {mv.product?.name}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`inline-flex px-2 py-0.5 text-xs font-bold rounded-full border ${
                              mv.type === "IN"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/40"
                                : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900/40"
                            }`}>
                              {mv.type === "IN" ? "Stock In (+)" : "Stock Out (-)"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right font-bold font-mono">
                            {mv.quantity} pcs
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 block">
                              {mv.referenceType}
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold font-mono">
                              ID: #{mv.referenceId}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-500 text-xs">
                            {mv.description || <span className="italic text-slate-400">No details</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {movementsTotalPages > 1 && (
                <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
                  <span className="text-xs text-slate-500">
                    Page {movementsPage} of {movementsTotalPages}
                  </span>
                  <div className="flex space-x-2">
                    <button
                      disabled={movementsPage === 1}
                      onClick={() => setMovementsPage(p => Math.max(1, p - 1))}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      disabled={movementsPage === movementsTotalPages}
                      onClick={() => setMovementsPage(p => Math.min(movementsTotalPages, p + 1))}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Log Stock Correction Modal */}
          {isAdjModalOpen && (
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center">
                    <ShieldAlert size={20} className="text-amber-500 mr-2" />
                    Record Stock Adjustment
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Manual adjustments are audit logged immediately. Overselling below zero is blocked by the database.
                  </p>
                </div>

                <form onSubmit={handleAdjSubmit} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Product Lookup *</label>
                    <select
                      required
                      value={adjForm.productId}
                      onChange={(e) => setAdjForm({ ...adjForm, productId: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                    >
                      <option value="">Select Product...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}{p.size ? ` (${p.size})` : ""} (Stock: {p.stockQuantity} pcs){p.sku ? ` [${p.sku}]` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">
                        {adjForm.reason === "Damaged" || adjForm.reason === "Expired" ? "Qty to Deduct *" : "Qty Change *"}
                      </label>
                      <input
                        type="number"
                        required
                        placeholder={
                          adjForm.reason === "Damaged" || adjForm.reason === "Expired"
                            ? "e.g. 5"
                            : "e.g. 10 or -5"
                        }
                        value={adjForm.quantity}
                        onChange={(e) => setAdjForm({ ...adjForm, quantity: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm font-semibold"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Standard Reason *</label>
                      <select
                        required
                        value={adjForm.reason}
                        onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm font-medium"
                      >
                        <option value="Damaged">Damaged Goods</option>
                        <option value="Expired">Expired Consignment</option>
                        <option value="Recount">Physical Audit Recount</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium leading-relaxed bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-lg border border-slate-100 dark:border-slate-800/40">
                    {adjForm.reason === "Damaged" || adjForm.reason === "Expired"
                      ? "⚡ This deducts inventory and automatically logs the product cost as a business overhead expense."
                      : "⚖️ Physical Recount accepts both positive (+) to add stock and negative (-) to remove stock. It updates stock audit logs without creating expenses."}
                  </p>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Authorization Secret Key *</label>
                    <input
                      type="password"
                      required
                      placeholder="Enter system secret key"
                      value={adjForm.secretKey}
                      onChange={(e) => setAdjForm({ ...adjForm, secretKey: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm font-semibold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Detailed Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Expired boxes identified on shelf C"
                      value={adjForm.description}
                      onChange={(e) => setAdjForm({ ...adjForm, description: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                    />
                  </div>

                  <div className="flex space-x-3 justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setIsAdjModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md shadow-sky-500/20 disabled:bg-sky-800 transition-colors"
                    >
                      {submitting ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      ) : (
                        <Check size={14} className="mr-2" />
                      )}
                      Commit Correction
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "sales" && (
        /* CUSTOMER SALES RETURNS TAB */
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Customer Sales Returns</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Process customer merchandise returns and deduct outstanding receivable ledger balances.
              </p>
            </div>
            {!isSalesReturnFormOpen && (
              <button
                onClick={() => { setIsSalesReturnFormOpen(true); }}
                className="inline-flex items-center justify-center px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 transition-all duration-150"
              >
                <Plus size={16} className="mr-2" /> Log Customer Return
              </button>
            )}
          </div>

          {!isSalesReturnFormOpen && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Sales Returns</p>
                  <p className="text-2xl font-black text-rose-600 dark:text-rose-455 mt-1 animate-fade-in">
                    Rs. {salesReturns.reduce((acc, r) => acc + Number(r.totalAmount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {isSalesReturnFormOpen ? (
            /* Record Sales Return Form */
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm max-w-3xl mx-auto">
              <h3 className="text-lg font-bold mb-4">Record Return Consignment</h3>
              <form onSubmit={handleSalesReturnSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Select Sales Invoice *</label>
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => handleInvoiceSelect(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm font-mono"
                  >
                    <option value="">Choose Invoice Reference...</option>
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNo} | {inv.customer?.name || "Walk-In counter"} | Total: Rs.{Number(inv.total).toFixed(0)}
                      </option>
                    ))}
                  </select>
                </div>

                {loadedInvoice && (
                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="font-semibold">Invoice items (pieces purchased)</span>
                      <span>Customer: <strong className="text-slate-700 dark:text-slate-300 capitalize">{loadedInvoice.customer?.name || "Counter Walk-in"}</strong></span>
                    </div>

                    <div className="space-y-3">
                      {salesReturnItems.map((item, index) => (
                        <div key={item.productId} className="flex flex-col md:flex-row md:items-center justify-between bg-slate-50/50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/50 gap-3">
                          <div className="flex-1">
                            <p className="font-medium text-slate-900 dark:text-white capitalize">{item.name}</p>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">{item.sku ? `${item.sku} | ` : ""}Invoiced: {item.maxQty} pcs</p>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="w-24">
                              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Return Qty</label>
                              <input
                                type="number"
                                min="0"
                                max={item.maxQty}
                                value={item.quantity === 0 ? "" : item.quantity}
                                onChange={(e) => handleSalesReturnItemQtyChange(index, e.target.value)}
                                placeholder="0"
                                className="w-full px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-center outline-none focus:ring-1 focus:ring-sky-500 font-semibold"
                              />
                            </div>
                            <div className="text-right w-24">
                              <p className="text-[10px] text-slate-400 uppercase">Credit Back</p>
                              <p className="text-xs font-bold mt-0.5">Rs. {(item.quantity * item.unitPrice).toFixed(0)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                      <div>
                        <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Reason for Return</label>
                        <input
                          type="text"
                          required
                          value={salesReturnReason}
                          onChange={(e) => setSalesReturnReason(e.target.value)}
                          placeholder="e.g. Wrong items sent, packaging damaged"
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Refund Method</label>
                        <select
                          value={salesReturnRefundType}
                          onChange={(e) => setSalesReturnRefundType(e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm font-semibold"
                        >
                          <option value="CREDIT">Store Credit (Ledger credit)</option>
                          <option value="CASH">Cash Refund (Paid back immediately)</option>
                        </select>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50 flex flex-col justify-center items-end text-right">
                        <p className="text-xs text-slate-400 uppercase font-semibold">Total Credit Return</p>
                        <p className="text-lg font-black text-rose-600 dark:text-rose-455">
                          Rs. {salesReturnItems.reduce((acc, curr) => acc + (curr.quantity * curr.unitPrice), 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex space-x-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsSalesReturnFormOpen(false);
                      setLoadedInvoice(null);
                      setSelectedInvoiceId("");
                      setSalesReturnItems([]);
                      setSalesReturnReason("");
                      setSalesReturnRefundType("CREDIT");
                    }}
                    className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !loadedInvoice}
                    className="px-4 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md shadow-sky-500/20 disabled:bg-sky-850 transition-colors"
                  >
                    {submitting ? "Processing..." : "Commit Return"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Sales Returns History list */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="px-6 py-4">Return No</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Invoice Ref</th>
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Refund Method</th>
                      <th className="px-6 py-4">Reason</th>
                      <th className="px-6 py-4 text-right">Credit Value (PKR)</th>
                      <th className="px-6 py-4 text-center no-print">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    {salesReturns.map((ret) => (
                      <tr key={ret.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                        <td className="px-6 py-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                          {ret.returnNo || `SR-000${ret.id}`}
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                          {new Date(ret.returnDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">{ret.invoice?.invoiceNo}</td>
                        <td className="px-6 py-4 font-semibold capitalize">{ret.customer?.name || "Walk-In counter"}</td>
                        <td className="px-6 py-4 text-xs font-semibold">
                          <span className={`px-2 py-0.5 rounded-lg ${ret.refundType === "CASH" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400" : "bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"}`}>
                            {ret.refundType || "CREDIT"}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 max-w-xs truncate">{ret.reason || <span className="italic text-slate-400">No notes</span>}</td>
                        <td className="px-6 py-4 text-right font-bold text-rose-600 dark:text-rose-400">
                          Rs. {Number(ret.totalAmount).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center no-print">
                          <button
                            type="button"
                            onClick={() => openReturnDetail(ret.id, "sales")}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg transition-colors"
                            title="View Receipt"
                          >
                            <Eye size={15} />
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
      )}

      {activeTab === "purchase" && (
        /* SUPPLIER PURCHASE RETURNS TAB */
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Supplier Purchase Returns</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Log stock returns back to suppliers. Decrements store stock levels and supplier ledger payables.
              </p>
            </div>
            {!isPurchaseReturnFormOpen && (
              <button
                onClick={() => { setIsPurchaseReturnFormOpen(true); }}
                className="inline-flex items-center justify-center px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 transition-all duration-150"
              >
                <Plus size={16} className="mr-2" /> Log Supplier Return
              </button>
            )}
          </div>

          {!isPurchaseReturnFormOpen && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Purchase Returns</p>
                  <p className="text-2xl font-black text-rose-600 dark:text-rose-455 mt-1 animate-fade-in">
                    Rs. {purchaseReturns.reduce((acc, r) => acc + Number(r.totalAmount || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          )}

          {isPurchaseReturnFormOpen ? (
            /* Record Purchase Return Form */
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm max-w-3xl mx-auto">
              <h3 className="text-lg font-bold mb-4">Record Supplier Dispatch Return</h3>
              <form onSubmit={handlePurchaseReturnSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Select Purchase Consignment *</label>
                  <select
                    value={selectedPurchaseId}
                    onChange={(e) => handlePurchaseSelect(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm font-mono"
                  >
                    <option value="">Select Inbound Purchase Reference...</option>
                    {purchases.map((pur) => (
                      <option key={pur.id} value={pur.id}>
                        {pur.purchaseNo} | {pur.supplier?.name} | Consigned: Rs.{Number(pur.total).toFixed(0)}
                      </option>
                    ))}
                  </select>
                </div>

                {loadedPurchase && (
                  <div className="space-y-4 pt-2">
                    <div className="flex justify-between items-center text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="font-semibold">Consigned items (pieces bought)</span>
                      <span>Supplier: <strong className="text-slate-700 dark:text-slate-300 capitalize">{loadedPurchase.supplier?.name}</strong></span>
                    </div>

                    <div className="space-y-3">
                      {purchaseReturnItems.map((item, index) => (
                        <div key={item.productId} className="flex flex-col md:flex-row md:items-center justify-between bg-slate-50/50 dark:bg-slate-950/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/50 gap-3">
                          <div className="flex-1">
                            <p className="font-medium text-slate-900 dark:text-white capitalize">{item.name}</p>
                            <p className="text-xs text-slate-400 font-mono mt-0.5">{item.sku ? `${item.sku} | ` : ""}Consigned: {item.maxQty} pcs</p>
                          </div>
                          <div className="flex items-center space-x-4">
                            <div className="w-24">
                              <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Return Qty</label>
                              <input
                                type="number"
                                min="0"
                                max={item.maxQty}
                                value={item.quantity === 0 ? "" : item.quantity}
                                onChange={(e) => handlePurchaseReturnItemQtyChange(index, e.target.value)}
                                placeholder="0"
                                className="w-full px-2 py-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-center outline-none focus:ring-1 focus:ring-sky-500 font-semibold"
                              />
                            </div>
                            <div className="text-right w-24">
                              <p className="text-[10px] text-slate-400 uppercase">Debit Back</p>
                              <p className="text-xs font-bold mt-0.5">Rs. {(item.quantity * item.unitCost).toFixed(0)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                      <div>
                        <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Reason for Return</label>
                        <input
                          type="text"
                          required
                          value={purchaseReturnReason}
                          onChange={(e) => setPurchaseReturnReason(e.target.value)}
                          placeholder="e.g. Expired stock returned, consignment defect"
                          className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                        />
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50 flex flex-col justify-center items-end text-right">
                        <p className="text-xs text-slate-400 uppercase font-semibold">Total Debit Return</p>
                        <p className="text-lg font-black text-rose-600 dark:text-rose-455">
                          Rs. {purchaseReturnItems.reduce((acc, curr) => acc + (curr.quantity * curr.unitCost), 0).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex space-x-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPurchaseReturnFormOpen(false);
                      setLoadedPurchase(null);
                      setSelectedPurchaseId("");
                      setPurchaseReturnItems([]);
                      setPurchaseReturnReason("");
                    }}
                    className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !loadedPurchase}
                    className="px-4 py-2.5 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md shadow-sky-500/20 disabled:bg-sky-850 transition-colors"
                  >
                    {submitting ? "Processing..." : "Commit Return"}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Purchase Returns History list */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="px-6 py-4">Return No</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Purchase Ref</th>
                      <th className="px-6 py-4">Supplier</th>
                      <th className="px-6 py-4">Reason</th>
                      <th className="px-6 py-4 text-right">Debit Value (PKR)</th>
                      <th className="px-6 py-4 text-center no-print">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                    {purchaseReturns.map((ret) => (
                      <tr key={ret.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                        <td className="px-6 py-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                          {ret.returnNo || `PR-000${ret.id}`}
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                          {new Date(ret.returnDate).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 font-mono text-xs">{ret.purchase?.purchaseNo}</td>
                        <td className="px-6 py-4 font-semibold capitalize">{ret.supplier?.name}</td>
                        <td className="px-6 py-4 text-slate-500 max-w-xs truncate">{ret.reason || <span className="italic text-slate-400">No notes</span>}</td>
                        <td className="px-6 py-4 text-right font-bold text-rose-600 dark:text-rose-455">
                          Rs. {Number(ret.totalAmount).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center no-print">
                          <button
                            type="button"
                            onClick={() => openReturnDetail(ret.id, "purchase")}
                            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg transition-colors"
                            title="View Receipt"
                          >
                            <Eye size={15} />
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
      )}

      {/* Return Details/Receipt Modal */}
      {isDetailOpen && selectedReturnDetail && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-6">
            {/* Header controls */}
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 no-print">
              <h3 className="font-bold text-slate-900 dark:text-white capitalize">
                {detailType === "sales" ? "Sales Return Receipt" : "Purchase Return Receipt"}
              </h3>
              <div className="flex space-x-2">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 rounded-lg border border-sky-200 dark:border-sky-900/40 hover:bg-sky-100 transition-colors"
                >
                  <Printer size={12} className="mr-1.5" /> Print Receipt
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
            <div className="print-area space-y-6 text-sm text-slate-800 dark:text-slate-200 font-sans">
              <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-sky-600 dark:text-sky-400">Sameer Distributors</h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Quetta, Pakistan | FMCG Supply Networks</p>
                </div>
                <div className="text-right">
                  <h2 className="font-mono text-lg font-bold text-slate-900 dark:text-white">
                    {selectedReturnDetail.returnNo || (detailType === "sales" ? `SR-000${selectedReturnDetail.id}` : `PR-000${selectedReturnDetail.id}`)}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Date: {new Date(selectedReturnDetail.returnDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Vendor & Client details */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                <div>
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">
                    {detailType === "sales" ? "Customer Info" : "Supplier Info"}
                  </p>
                  <p className="font-bold text-slate-900 dark:text-white mt-0.5 capitalize">
                    {detailType === "sales"
                      ? (selectedReturnDetail.customer?.name || "Walk-In counter")
                      : selectedReturnDetail.supplier?.name}
                  </p>
                  {detailType === "sales" ? (
                    <>
                      {selectedReturnDetail.customer?.phone && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{selectedReturnDetail.customer.phone}</p>}
                      {selectedReturnDetail.customer?.address && <p className="text-xs text-slate-400 mt-0.5">{selectedReturnDetail.customer.address}</p>}
                    </>
                  ) : (
                    <>
                      {selectedReturnDetail.supplier?.phone && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{selectedReturnDetail.supplier.phone}</p>}
                      {selectedReturnDetail.supplier?.address && <p className="text-xs text-slate-400 mt-0.5">{selectedReturnDetail.supplier.address}</p>}
                    </>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400 uppercase font-semibold">Reference Details</p>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {detailType === "sales"
                      ? `Ref Invoice: ${selectedReturnDetail.invoice?.invoiceNo || "-"}`
                      : `Ref Purchase: ${selectedReturnDetail.purchase?.purchaseNo || "-"}`}
                  </p>
                  {detailType === "sales" && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Refund Method: <span className="font-bold">{selectedReturnDetail.refundType || "CREDIT"}</span>
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">
                    Operator: <span className="font-semibold capitalize">{selectedReturnDetail.createdBy?.name || "System"}</span> ({selectedReturnDetail.createdBy?.role || "Staff"})
                  </p>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="px-4 py-3">Product Description</th>
                      <th className="px-4 py-3 text-center">SKU</th>
                      <th className="px-4 py-3 text-right">Qty (pieces)</th>
                      <th className="px-4 py-3 text-right">{detailType === "sales" ? "Unit Price" : "Unit Cost"}</th>
                      <th className="px-4 py-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedReturnDetail.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white capitalize">
                          {item.product?.name}{item.product?.size ? ` (${item.product.size})` : ""}
                        </td>
                        <td className="px-4 py-2.5 text-center font-mono text-slate-500 dark:text-slate-400">
                          {item.product?.sku || "-"}
                        </td>
                        <td className="px-4 py-2.5 text-right font-semibold">{item.quantity} pcs</td>
                        <td className="px-4 py-2.5 text-right">
                          Rs. {Number(detailType === "sales" ? item.unitPrice : item.unitCost).toFixed(2)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold">
                          Rs. {Number(detailType === "sales" ? item.totalPrice : item.totalCost).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Summary totals */}
              <div className="flex justify-between items-start pt-2">
                <div className="text-xs text-slate-500 max-w-xs">
                  <span className="font-semibold block uppercase text-[10px] text-slate-400">Notes / Reason:</span>
                  <span className="italic block mt-0.5">{selectedReturnDetail.reason || "No notes provided"}</span>
                </div>
                <div className="w-64 space-y-1.5 text-xs text-right">
                  <div className="flex justify-between font-bold border-t border-slate-200 dark:border-slate-800 pt-2 text-slate-950 dark:text-white">
                    <span>Total Refund Value:</span>
                    <span className="text-rose-600 dark:text-rose-400 text-sm">
                      Rs. {Number(selectedReturnDetail.totalAmount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Returns;
