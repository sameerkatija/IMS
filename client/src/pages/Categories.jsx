import React, { useState, useEffect } from "react";
import api from "../services/api";
import { Tag, Plus, Edit2, Trash2, Search } from "lucide-react";
import Toast from "../components/Toast";

const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [name, setName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/product-category");
      if (response.data && response.data.type === "success") {
        setCategories(response.data.data);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to fetch categories.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSubmitting(true);
      if (selectedCategory) {
        // Edit
        const response = await api.put(`/api/product-category/${selectedCategory.id}`, { name });
        if (response.data?.type === "success") {
          setToast({ message: "Category updated successfully.", type: "success" });
          fetchCategories();
          closeModal();
        }
      } else {
        // Create
        const response = await api.post("/api/product-category", { name });
        if (response.data?.type === "success") {
          setToast({ message: "Category created successfully.", type: "success" });
          fetchCategories();
          closeModal();
        }
      }
    } catch (err) {
      console.error(err);
      setToast({
        message: err.response?.data?.message || "Failed to process category.",
        type: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const nextStatus = !currentStatus;
    if (!window.confirm(`Are you sure you want to ${nextStatus ? "activate" : "deactivate"} this category?`)) return;
    try {
      let response;
      if (nextStatus) {
          response = await api.put(`/api/product-category/${id}/activate`, { isActive: nextStatus }); 
      } else {
          response = await api.delete(`/api/product-category/${id}`, { isActive: nextStatus });
      }
        
      if (response.data?.type === "success") {
        setToast({ message: `Category ${nextStatus ? "activated" : "deactivated"} successfully.`, type: "success" });
        fetchCategories();
      }
    } catch (err) {
      console.error(err);
      setToast({
        message: err.response?.data?.message || "Failed to update category status.",
        type: "error",
      });
    }
  };

  const openModal = (category = null) => {
    if (category) {
      setSelectedCategory(category);
      setName(category.name);
    } else {
      setSelectedCategory(null);
      setName("");
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedCategory(null);
    setName("");
  };

  const filteredCategories = categories.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 dark:border-slate-800 pb-5 gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Categories</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Create, update, and manage groupings for your FMCG inventory inventory items.
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 active:scale-95 transition-all duration-150"
        >
          <Plus size={16} className="mr-2" /> Add Category
        </button>
      </div>

      {/* Filter and search */}
      <div className="flex items-center max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
        <Search className="text-slate-400 mr-2 flex-shrink-0" size={18} />
        <input
          type="text"
          placeholder="Search categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full text-sm bg-transparent outline-none border-none focus:ring-0 placeholder-slate-400"
        />
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <Tag className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={40} />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No categories found</h3>
          <p className="text-sm text-slate-400 mt-1">Get started by creating a new category.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-4">Category ID</th>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {filteredCategories.map((category) => (
                  <tr key={category.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                    <td className="px-6 py-4 font-mono text-xs text-slate-400">
                      #{category.id}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-950 dark:text-white capitalize">
                      {category.name}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full border ${
                        category.isActive
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/40"
                          : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-455 dark:border-rose-900/40"
                      }`}>
                        {category.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleToggleStatus(category.id, category.isActive)}
                        className={`inline-flex items-center px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                          category.isActive
                            ? "text-rose-600 hover:bg-rose-50 border-rose-200 dark:border-rose-900/40 dark:hover:bg-rose-950/20"
                            : "text-emerald-600 hover:bg-emerald-50 border-emerald-200 dark:border-emerald-900/40 dark:hover:bg-emerald-950/20"
                        }`}
                      >
                        {category.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => openModal(category)}
                        className="inline-flex items-center p-1.5 text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      >
                        <Edit2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {selectedCategory ? "Edit Category" : "Add New Category"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Categories help catalog and organize products at POS.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                  Category Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diapers, Tissues, Soaps"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm transition-all duration-200"
                />
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
                  {selectedCategory ? "Update Category" : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Categories;
