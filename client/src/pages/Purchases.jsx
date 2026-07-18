import React, { useState, useEffect } from "react";
import api from "../services/api";
import { ShoppingCart, Plus, Search, FileText, Printer, Trash2, Eye, Calendar } from "lucide-react";
import Toast from "../components/Toast";

const Purchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);

  // Create form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [discount, setDiscount] = useState("0");
  const [discountType, setDiscountType] = useState("PKR"); // default is PKR
  const [paidAmount, setPaidAmount] = useState("0");
  const [creditApplied, setCreditApplied] = useState("0");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState([{ productId: "", quantity: "", unitCost: "" }]);
  const [submitting, setSubmitting] = useState(false);

  // Detail view state
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/api/purchase?page=${page}&limit=${limit}`);
      if (response.data && response.data.type === "success") {
        setPurchases(response.data.data);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load purchases.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliersAndProducts = async () => {
    try {
      const [suppRes, prodRes] = await Promise.all([
        api.get("/api/supplier?limit=100"),
        api.get("/api/product?limit=200&isActive=true")
      ]);
      if (suppRes.data?.type === "success") setSuppliers(suppRes.data.data);
      if (prodRes.data?.type === "success") setProducts(prodRes.data.data);
    } catch (err) {
      console.error("Error fetching dependencies:", err);
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [page]);

  useEffect(() => {
    fetchSuppliersAndProducts();
  }, []);

  const addItemRow = () => {
    setItems([...items, { productId: "", quantity: "", unitCost: "" }]);
  };

  const removeItemRow = (index) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index, field, value) => {
    const updated = [...items];
    updated[index][field] = value;

    // Auto-fill unitCost if product is selected
    if (field === "productId" && value) {
      const selectedProd = products.find(p => p.id === Number(value));
      if (selectedProd) {
        updated[index].unitCost = selectedProd.costPrice.toString();
      }
    }

    setItems(updated);
  };

  // Compute totals
  const subtotal = items.reduce((acc, curr) => {
    const qty = Number(curr.quantity) || 0;
    const cost = Number(curr.unitCost) || 0;
    return acc + (qty * cost);
  }, 0);

  const calculatedDiscountAmount = discountType === "%"
    ? (subtotal * (Number(discount) || 0)) / 100
    : (Number(discount) || 0);

  const total = Math.max(0, subtotal - calculatedDiscountAmount);

  const handlePurchaseSubmit = async (e) => {
    e.preventDefault();
    if (!supplierId) {
      setToast({ message: "Please select a supplier.", type: "error" });
      return;
    }

    const validItems = items.filter(it => it.productId && Number(it.quantity) > 0 && Number(it.unitCost) >= 0);
    if (validItems.length === 0) {
      setToast({ message: "Purchase must contain at least one valid item.", type: "error" });
      return;
    }

    try {
      setSubmitting(true);
      const paid = Number(paidAmount) || 0;
      const credit = Number(creditApplied) || 0;

      const selectedSup = suppliers.find(s => s.id === Number(supplierId));
      const availCredit = selectedSup && selectedSup.balance < 0 ? Math.abs(Number(selectedSup.balance)) : 0;

      if (paid < 0) {
        setToast({ message: "Paid amount cannot be negative.", type: "error" });
        return;
      }
      if (credit < 0) {
        setToast({ message: "Credit applied cannot be negative.", type: "error" });
        return;
      }
      if (credit > availCredit) {
        setToast({ message: `Applied credit cannot exceed available supplier credit (Rs. ${availCredit.toFixed(2)}).`, type: "error" });
        return;
      }
      if (paid + credit > total) {
        setToast({ message: "Sum of paid amount and credit applied cannot exceed total purchase cost.", type: "error" });
        return;
      }

      const payload = {
        supplierId: Number(supplierId),
        discount: calculatedDiscountAmount,
        paidAmount: paid,
        creditApplied: credit,
        description: description || null,
        items: validItems.map(it => ({
          productId: Number(it.productId),
          quantity: Number(it.quantity),
          unitCost: Number(it.unitCost)
        }))
      };

      const response = await api.post("/api/purchase", payload);
      if (response.data && response.data.type === "success") {
        setToast({ message: "Purchase logged successfully.", type: "success" });
        fetchPurchases();
        // Reset and close
        setSupplierId("");
        setDiscount("0");
        setDiscountType("PKR");
        setPaidAmount("0");
        setCreditApplied("0");
        setDescription("");
        setItems([{ productId: "", quantity: "", unitCost: "" }]);
        setIsFormOpen(false);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to record purchase.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (purchase) => {
    try {
      const response = await api.get(`/api/purchase/${purchase.id}`);
      if (response.data && response.data.type === "success") {
        setSelectedPurchase(response.data.data);
        setIsDetailOpen(true);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load purchase receipt details.", type: "error" });
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
          <h1 className="text-2xl font-bold tracking-tight">Stock Purchase Log</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Ingest inventory purchases from suppliers. Increments stock counts and supplier ledgers.
          </p>
        </div>
        {!isFormOpen ? (
          <button
            onClick={() => setIsFormOpen(true)}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 active:scale-95 transition-all duration-150"
          >
            <Plus size={16} className="mr-2" /> Log Stock Purchase
          </button>
        ) : (
          <button
            onClick={() => setIsFormOpen(false)}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-sm font-semibold rounded-xl active:scale-95 transition-all duration-150"
          >
            Back to History
          </button>
        )}
      </div>

      {isFormOpen ? (
        /* Create Purchase Form View */
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm max-w-4xl mx-auto no-print">
          <h2 className="text-lg font-bold mb-4">Record Stock Ingest</h2>

          <form onSubmit={handlePurchaseSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Supplier *</label>
                <select
                  required
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} (Bal: Rs.{Number(s.balance).toFixed(0)})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Purchase Notes</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Bulk soap consignment"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                />
              </div>
            </div>

            {/* Line Items Container */}
            <div className="space-y-3">
              <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Consignment Line Items</span>
                <button
                  type="button"
                  onClick={addItemRow}
                  className="inline-flex items-center px-2.5 py-1 text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 rounded-lg border border-sky-200 dark:border-sky-900/40 hover:bg-sky-100 transition-colors"
                >
                  <Plus size={12} className="mr-1" /> Add Row
                </button>
              </div>

              <div className="space-y-3">
                {items.map((item, index) => (
                  <div key={index} className="flex flex-col md:flex-row md:items-end gap-3 bg-slate-50/50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/50 relative">
                    <div className="flex-1">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Product *</label>
                      <select
                        required
                        value={item.productId}
                        onChange={(e) => handleItemChange(index, "productId", e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                      >
                        <option value="">Search Product...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}{p.size ? ` (${p.size})` : ""}{p.sku ? ` [${p.sku}]` : ""}
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
                        placeholder="Pieces"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                      />
                    </div>

                    <div className="w-full md:w-36">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Cost Per Piece *</label>
                      <input
                        type="number"
                        required
                        step="0.01"
                        min="0"
                        placeholder="Cost"
                        value={item.unitCost}
                        onChange={(e) => handleItemChange(index, "unitCost", e.target.value)}
                        className="w-full px-3 py-1.5 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-lg focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                      />
                    </div>

                    <div className="w-full md:w-36">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase block mb-1">Line Subtotal</label>
                      <div className="w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-850 rounded-lg text-sm text-slate-500 text-right font-semibold select-none">
                        Rs. {((Number(item.quantity) || 0) * (Number(item.unitCost) || 0)).toFixed(2)}
                      </div>
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItemRow(index)}
                        className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg border border-transparent hover:border-rose-100 transition-all self-center md:self-end mb-0.5"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Discount, Paid Amount, Applied Credit and Summary panel */}
            {(() => {
              const selectedSup = suppliers.find(s => s.id === Number(supplierId));
              const availCredit = selectedSup && selectedSup.balance < 0 ? Math.abs(Number(selectedSup.balance)) : 0;
              return (
                <div className="border-t border-slate-200 dark:border-slate-800 pt-4 flex flex-col md:flex-row md:justify-between items-end gap-4">
                  <div className="flex flex-wrap gap-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block">Consignment Discount</label>
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
                        placeholder="0.00"
                        className="w-36 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Amount Paid Upfront (PKR)</label>
                      <input
                        type="number"
                        value={paidAmount}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        placeholder="0.00"
                        min="0"
                        max={total}
                        className="w-44 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">
                        Credit Applied (Max: Rs. {availCredit.toFixed(0)})
                      </label>
                      <input
                        type="number"
                        value={creditApplied}
                        onChange={(e) => setCreditApplied(e.target.value)}
                        placeholder="0.00"
                        min="0"
                        max={Math.min(total - (Number(paidAmount) || 0), availCredit)}
                        disabled={availCredit <= 0}
                        className="w-48 px-3 py-1.5 bg-slate-50 dark:bg-slate-950 disabled:opacity-50 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 outline-none text-sm"
                      />
                      {availCredit > 0 && (
                        <span className="text-[10px] text-sky-500 font-semibold block mt-1">
                          Available Credit: Rs. {availCredit.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-right w-full md:w-80 space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Items Subtotal:</span>
                      <span className="font-semibold">Rs. {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-rose-500">
                      <span>Consignment Discount:</span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">
                        {discountType === "%"
                          ? `- ${Number(discount || 0)}% (Rs. ${calculatedDiscountAmount.toFixed(2)})`
                          : `- Rs. ${Number(discount || 0).toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400 border-t border-slate-200 dark:border-slate-800/60 pt-1.5">
                      <span>Total Cost:</span>
                      <span className="font-semibold">Rs. {total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                      <span>Amount Paid (Cash):</span>
                      <span className="font-semibold">- Rs. {Number(paidAmount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-blue-500">
                      <span>Credit Applied:</span>
                      <span className="font-semibold">- Rs. {Number(creditApplied || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold border-t border-slate-200 dark:border-slate-800 pt-2 text-slate-950 dark:text-white">
                      <span>Balance Due:</span>
                      <span className="text-sky-600 dark:text-sky-400">
                        Rs. {Math.max(0, total - (Number(paidAmount) || 0) - (Number(creditApplied) || 0)).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

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
                  <ShoppingCart size={16} className="mr-2" />
                )}
                Commit Purchase
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Purchase History View */
        <div className="space-y-4 no-print">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <ShoppingCart className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={40} />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No purchases recorded</h3>
              <p className="text-sm text-slate-400 mt-1">Ingest consignments from suppliers to build your store inventory.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        <th className="px-6 py-4">Consignment No</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Supplier</th>
                        <th className="px-6 py-4">Total (PKR)</th>
                        <th className="px-6 py-4">Paid</th>
                        <th className="px-6 py-4">Credit Used</th>
                        <th className="px-6 py-4">Balance</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                      {purchases.map((purchase) => (
                        <tr key={purchase.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                          <td className="px-6 py-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                            {purchase.purchaseNo}
                          </td>
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                            <span className="flex items-center">
                              <Calendar size={12} className="mr-1.5" />
                              {new Date(purchase.purchaseDate).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white capitalize">
                            {purchase.supplier?.name}
                          </td>
                          <td className="px-6 py-4 font-bold text-xs">
                            Rs. {Number(purchase.total).toFixed(2)}
                            {Number(purchase.discount) > 0 && (
                              <div className="text-[10px] text-rose-500 font-semibold mt-0.5">
                                (Disc: -Rs.{Number(purchase.discount).toFixed(0)})
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                            Rs. {Number(purchase.paidAmount || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-xs font-semibold text-blue-500">
                            Rs. {Number(purchase.creditApplied || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-xs font-bold text-slate-900 dark:text-white">
                            Rs. {Number(purchase.balanceDue || 0).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-xs">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${purchase.status === "PAID"
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/30"
                              : purchase.status === "PARTIALLY_PAID"
                                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/30"
                                : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-900/30"
                              }`}>
                              {purchase.status || "UNPAID"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => openDetail(purchase)}
                              className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors"
                            >
                              <Eye size={12} className="mr-1" /> View Invoice
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

      {/* Invoice Details Modal */}
      {isDetailOpen && selectedPurchase && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-6">
            {/* Header controls */}
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 no-print">
              <h3 className="font-bold text-slate-900 dark:text-white">Purchase Invoice Detail</h3>
              <div className="flex space-x-2">
                <button
                  onClick={handlePrint}
                  className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 rounded-lg border border-sky-200 dark:border-sky-900/40 hover:bg-sky-100 transition-colors"
                >
                  <Printer size={12} className="mr-1.5" /> Print Invoice
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
            <div className="print-area text-slate-900 dark:text-slate-100 font-sans" style={{ fontSize: '12px' }}>
              {/* ===== COMPANY HEADER ===== */}
              <div className="border-b-2 border-slate-900 dark:border-slate-200 print:border-black" style={{ textAlign: 'center', paddingBottom: '10px', marginBottom: '12px' }}>
                <h1 style={{ fontSize: '20px', fontWeight: '900', margin: '0 0 2px 0', letterSpacing: '0.5px' }}>Sameer Distributors</h1>
                <p className="text-slate-600 dark:text-slate-300 print:text-slate-800" style={{ fontSize: '11px', margin: '0' }}>Quetta, Pakistan &nbsp;|&nbsp; Contact: 03342320521</p>
              </div>

              {/* ===== PURCHASE META ===== */}
              <div style={{ marginBottom: '12px', lineHeight: '1.8' }}>
                <p style={{ margin: '0' }}><strong>Purchase No:</strong> {selectedPurchase.purchaseNo}</p>
                <p style={{ margin: '0' }}><strong>Date:</strong> {new Date(selectedPurchase.purchaseDate).toISOString().split('T')[0]}</p>
                <p style={{ margin: '0' }}><strong>Supplier:</strong> {selectedPurchase.supplier?.name.toUpperCase()}</p>
                {selectedPurchase.supplier?.phone && (
                  <p style={{ margin: '0' }}><strong>Phone:</strong> {selectedPurchase.supplier.phone}</p>
                )}
                {selectedPurchase.supplier?.address && (
                  <p style={{ margin: '0' }}><strong>Address:</strong> {selectedPurchase.supplier.address.toUpperCase()}</p>
                )}
                <p style={{ margin: '0' }}><strong>Operator:</strong> {selectedPurchase.createdBy?.name?.toUpperCase() || "SYSTEM"} ({selectedPurchase.createdBy?.role || "Staff"})</p>
              </div>

              {/* ===== ITEMS TABLE ===== */}
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px', fontSize: '11px' }}>
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-800 border-t border-b border-slate-900 dark:border-slate-200 print:border-black">
                    <th style={{ padding: '5px 6px', textAlign: 'left', fontWeight: '700' }} className="border-r border-slate-300 dark:border-slate-700 print:border-slate-300">Product ID</th>
                    <th style={{ padding: '5px 6px', textAlign: 'left', fontWeight: '700' }} className="border-r border-slate-300 dark:border-slate-700 print:border-slate-300">Item</th>
                    <th style={{ padding: '5px 6px', textAlign: 'right', fontWeight: '700' }} className="border-r border-slate-300 dark:border-slate-700 print:border-slate-300">Unit Cost</th>
                    <th style={{ padding: '5px 6px', textAlign: 'right', fontWeight: '700' }} className="border-r border-slate-300 dark:border-slate-700 print:border-slate-300">Qty</th>
                    <th style={{ padding: '5px 6px', textAlign: 'right', fontWeight: '700' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPurchase.items?.map((item, idx) => (
                    <tr key={item.id || idx} className="border-b border-slate-200 dark:border-slate-800 print:border-slate-200">
                      <td style={{ padding: '5px 6px', fontWeight: '600' }} className="border-r border-slate-200 dark:border-slate-800 print:border-slate-200">{String(idx + 1).padStart(3, '0')}</td>
                      <td style={{ padding: '5px 6px', textTransform: 'uppercase', fontWeight: '500' }} className="border-r border-slate-200 dark:border-slate-800 print:border-slate-200">
                        {item.product?.name}{item.product?.size ? ` (${item.product.size})` : ""}
                      </td>
                      <td style={{ padding: '5px 6px', textAlign: 'right' }} className="border-r border-slate-200 dark:border-slate-800 print:border-slate-200">{Number(item.unitCost).toFixed(2)}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: '600' }} className="border-r border-slate-200 dark:border-slate-800 print:border-slate-200">{item.quantity}</td>
                      <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: '700' }}>{Number(item.totalCost).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* ===== SUMMARY SECTION ===== */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <div style={{ minWidth: '300px', fontSize: '12px' }}>
                  <div className="border-t border-slate-300 dark:border-slate-700 print:border-slate-300" style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                    <span>Items Subtotal:</span>
                    <span style={{ fontWeight: '700' }}>PKR {Number(selectedPurchase.subtotal).toFixed(2)}</span>
                  </div>
                  {Number(selectedPurchase.discount) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                      <span>Discount Deduct:</span>
                      <span style={{ fontWeight: '600', color: '#dc2626' }}>- PKR {Number(selectedPurchase.discount).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t-2 border-slate-900 dark:border-slate-200 print:border-black" style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', marginTop: '4px' }}>
                    <span style={{ fontWeight: '800', fontSize: '13px' }}>NET TOTAL COST:</span>
                    <span style={{ fontWeight: '900', fontSize: '13px' }}>PKR {Number(selectedPurchase.total).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#16a34a' }}>
                    <span>Amount Paid:</span>
                    <span style={{ fontWeight: '600' }}>PKR {Number(selectedPurchase.paidAmount).toFixed(2)}</span>
                  </div>
                  {Number(selectedPurchase.creditApplied) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#3b82f6' }}>
                      <span>Credit Applied:</span>
                      <span style={{ fontWeight: '600' }}>PKR {Number(selectedPurchase.creditApplied).toFixed(2)}</span>
                    </div>
                  )}
                  {Number(selectedPurchase.balanceDue) > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#dc2626', fontWeight: '700' }}>
                      <span>Balance Due:</span>
                      <span>PKR {Number(selectedPurchase.balanceDue).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>

              {selectedPurchase.description && (
                <div className="border-t border-slate-200 dark:border-slate-800 print:border-slate-200 text-slate-500 dark:text-slate-400" style={{ marginTop: '12px', paddingTop: '6px', fontSize: '11px', fontStyle: 'italic' }}>
                  Notes: {selectedPurchase.description}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Purchases;
