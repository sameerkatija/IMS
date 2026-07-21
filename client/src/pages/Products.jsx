import React, { useState, useEffect } from "react";
import api from "../services/api";
import { Package, Plus, Edit2, CheckCircle, AlertTriangle, Search, Filter } from "lucide-react";
import Toast from "../components/Toast";

const Products = () => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState("all");
  const [toast, setToast] = useState(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);
  const [totalProducts, setTotalProducts] = useState(0);

  // Form modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    size: "",
    barcode: "",
    categoryId: "",
    costPrice: "",
    sellingPrice: "",
    lowStockLevel: "0",
    piecesPerCarton: ""
  });

  const fetchProducts = async () => {
    try {
      setLoading(true);
      let queryParams = `?page=${page}&limit=${limit}`;
      if (search.trim()) queryParams += `&search=${encodeURIComponent(search)}`;
      if (selectedCategory) queryParams += `&categoryId=${selectedCategory}`;
      if (isActiveFilter !== "all") queryParams += `&isActive=${isActiveFilter === "active"}`;

      const response = await api.get(`/api/product${queryParams}`);
      if (response.data && response.data.type === "success") {
        setProducts(response.data.data);
        setTotalPages(response.data.pagination.totalPages);
        setTotalProducts(response.data.pagination.total);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load products.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get("/api/product-category?isActive=true");
      if (response.data && response.data.type === "success") {
        setCategories(response.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [page, search, selectedCategory, isActiveFilter]);

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const openModal = (product = null) => {
    if (product) {
      setSelectedProduct(product);
      setFormData({
        name: product.name,
        sku: product.sku || "",
        size: product.size || "",
        barcode: product.barcode || "",
        categoryId: product.categoryId.toString(),
        costPrice: product.costPrice.toString(),
        sellingPrice: product.sellingPrice.toString(),
        lowStockLevel: product.lowStockLevel.toString(),
        piecesPerCarton: product.piecesPerCarton ? product.piecesPerCarton.toString() : ""
      });
    } else {
      setSelectedProduct(null);
      setFormData({
        name: "",
        sku: "",
        size: "",
        barcode: "",
        categoryId: categories[0]?.id.toString() || "",
        costPrice: "",
        sellingPrice: "",
        lowStockLevel: "10",
        piecesPerCarton: "24"
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedProduct(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.categoryId || !formData.costPrice || !formData.sellingPrice) {
      setToast({ message: "Please fill all required fields.", type: "error" });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: formData.name,
        sku: formData.sku || null,
        size: formData.size || null,
        barcode: formData.barcode || null,
        categoryId: Number(formData.categoryId),
        costPrice: Number(formData.costPrice),
        sellingPrice: Number(formData.sellingPrice),
        lowStockLevel: Number(formData.lowStockLevel),
        piecesPerCarton: formData.piecesPerCarton ? Number(formData.piecesPerCarton) : null
      };

      let response;
      if (selectedProduct) {
        response = await api.put(`/api/product/${selectedProduct.id}`, payload);
      } else {
        response = await api.post("/api/product", payload);
      }

      if (response.data && response.data.type === "success") {
        setToast({
          message: selectedProduct ? "Product updated successfully." : "Product created successfully.",
          type: "success"
        });
        fetchProducts();
        closeModal();
      }
    } catch (err) {
      console.error(err);
      setToast({
        message: err.response?.data?.message || "Failed to save product.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (product) => {
    try {
      const endpoint = product.isActive
        ? `/api/product/${product.id}` // DELETE deactivates product
        : `/api/product/${product.id}/activate`; // PUT activates

      const response = product.isActive
        ? await api.delete(endpoint)
        : await api.put(endpoint);

      if (response.data && response.data.type === "success") {
        setToast({ message: `Product ${product.isActive ? "deactivated" : "activated"} successfully.`, type: "success" });
        fetchProducts();
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to update status.", type: "error" });
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

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 dark:border-slate-800 pb-5 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Products List
            <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2.5 py-1 rounded-full font-semibold border border-slate-200/50 dark:border-slate-800/50">
              {totalProducts} Total
            </span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Create, search, and monitor items. Low stock alerts are highlighted in yellow.
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 active:scale-95 transition-all duration-150"
        >
          <Plus size={16} className="mr-2" /> Add Product
        </button>
      </div>

      {/* Filters Panel */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        {/* Search */}
        <div className="w-full md:w-72 flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
          <Search className="text-slate-400 mr-2 flex-shrink-0" size={16} />
          <input
            type="text"
            placeholder="Search SKU or name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full text-sm bg-transparent outline-none border-none focus:ring-0 placeholder-slate-400"
          />
        </div>

        {/* Category select */}
        <div className="w-full md:w-56 flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
          <Filter className="text-slate-400 mr-2 flex-shrink-0" size={14} />
          <select
            value={selectedCategory}
            onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
            className="w-full text-sm bg-transparent border-none outline-none focus:ring-0 text-slate-700 dark:text-slate-300"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Active toggle */}
        <div className="w-full md:w-48 flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
          <select
            value={isActiveFilter}
            onChange={(e) => { setIsActiveFilter(e.target.value); setPage(1); }}
            className="w-full text-sm bg-transparent border-none outline-none focus:ring-0 text-slate-700 dark:text-slate-300"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* Grid or Table */}
      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <Package className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={40} />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No products found</h3>
          <p className="text-sm text-slate-400 mt-1">Adjust filters or register a new product.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4">SKU / Barcode</th>
                    <th className="px-6 py-4">Product Name</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4 text-right">Cost Price</th>
                    <th className="px-6 py-4 text-right">WAC Price</th>
                    <th className="px-6 py-4 text-right">Selling Price</th>
                    <th className="px-6 py-4 text-center">Stock Level</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {products.map((p) => {
                    const isLowStock = p.stockQuantity <= p.lowStockLevel;
                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                        <td className="px-6 py-4">
                          <div className="font-mono text-xs font-semibold">{p.sku || "-"}</div>
                          {p.barcode && <div className="text-slate-400 text-xs mt-0.5">{p.barcode}</div>}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-950 dark:text-white capitalize">
                          <div>{p.name}</div>
                          {p.size && <div className="text-slate-400 text-xs font-normal mt-0.5">{p.size}</div>}
                        </td>
                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 capitalize">
                          {p.category?.name}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold">
                          Rs. {Number(p.costPrice).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold">
                          Rs. {Number(p.weightedAvgCost).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-right font-semibold text-sky-600 dark:text-sky-400">
                          Rs. {Number(p.sellingPrice).toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${isLowStock
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 border border-amber-200 dark:border-amber-900/30"
                            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/30"
                            }`}>
                            {isLowStock && <AlertTriangle size={12} className="mr-1" />}
                            {p.stockQuantity} pcs
                          </span>
                          {p.piecesPerCarton && (
                            <div className="text-slate-400 text-[10px] mt-0.5">
                              ({Math.floor(p.stockQuantity / p.piecesPerCarton)} ctn {p.stockQuantity % p.piecesPerCarton} pcs)
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => toggleStatus(p)}
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${p.isActive
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                              }`}
                          >
                            {p.isActive ? "Active" : "Inactive"}
                          </button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => openModal(p)}
                            className="inline-flex items-center p-1.5 text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            <Edit2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
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

      {/* Product Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {selectedProduct ? "Edit Product" : "Add New Product"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Enter details carefully. All transactions operate at the individual pieces level.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Product Name *</label>
                  <input
                    type="text"
                    required
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Shield Wipes Extra"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">SKU Code (Optional)</label>
                  <input
                    type="text"
                    name="sku"
                    value={formData.sku}
                    onChange={handleInputChange}
                    placeholder="e.g. SHIELD-WP-72"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Barcode (Optional)</label>
                  <input
                    type="text"
                    name="barcode"
                    value={formData.barcode}
                    onChange={handleInputChange}
                    placeholder="Scan or type barcode"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Size (Optional)</label>
                  <input
                    type="text"
                    name="size"
                    value={formData.size}
                    onChange={handleInputChange}
                    placeholder="e.g. Size M, XL, 500ml"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Category *</label>
                  <select
                    name="categoryId"
                    value={formData.categoryId}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                  >
                    <option value="" disabled>Select Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Pieces Per Carton (Display helper)</label>
                  <input
                    type="number"
                    name="piecesPerCarton"
                    value={formData.piecesPerCarton}
                    onChange={handleInputChange}
                    placeholder="e.g. 72"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Cost Price (per piece) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    name="costPrice"
                    value={formData.costPrice}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Selling Price (per piece) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    name="sellingPrice"
                    value={formData.sellingPrice}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Low Stock Level (pieces) *</label>
                  <input
                    type="number"
                    required
                    name="lowStockLevel"
                    value={formData.lowStockLevel}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div className="flex space-x-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={closeModal}
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
                    <Plus size={14} className="mr-2" />
                  )}
                  {selectedProduct ? "Update Product" : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Products;
