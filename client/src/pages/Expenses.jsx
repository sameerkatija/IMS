import React, { useState, useEffect } from "react";
import api from "../services/api";
import { TrendingDown, Plus, Search, Calendar, Landmark, Receipt, Edit2, Trash2, Tag, Check } from "lucide-react";
import Toast from "../components/Toast";

const Expenses = () => {
  const [activeSubTab, setActiveSubTab] = useState("expenses"); // "expenses" | "categories"
  const [toast, setToast] = useState(null);

  // Overhead Expenses State
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    categoryId: "",
    amount: "",
    description: "",
    expenseDate: new Date().toISOString().substring(0, 10),
  });

  // Pagination for Expenses
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);

  // Expense Categories State
  const [categories, setCategories] = useState([]);
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [selectedCatForEdit, setSelectedCatForEdit] = useState(null);
  const [catName, setCatName] = useState("");
  const [catSubmitting, setCatSubmitting] = useState(false);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      let queryParams = `?page=${page}&limit=${limit}`;
      if (search.trim()) queryParams += `&search=${encodeURIComponent(search)}`;
      if (selectedCategory) queryParams += `&categoryId=${selectedCategory}`;

      const response = await api.get(`/api/expense${queryParams}`);
      if (response.data && response.data.type === "success") {
        setExpenses(response.data.data);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load expenses.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await api.get("/api/expense-category");
      if (response.data && response.data.type === "success") {
        setCategories(response.data.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeSubTab === "expenses") {
      fetchExpenses();
    }
  }, [page, search, selectedCategory, activeSubTab]);

  useEffect(() => {
    fetchCategories();
  }, []);

  // Expense Form Modal Handlers
  const openModal = (expense = null) => {
    const activeCats = categories.filter(c => c.isActive);
    if (expense) {
      setSelectedExpense(expense);
      setFormData({
        categoryId: expense.categoryId.toString(),
        amount: expense.amount.toString(),
        description: expense.description || "",
        expenseDate: new Date(expense.expenseDate).toISOString().substring(0, 10),
      });
    } else {
      setSelectedExpense(null);
      setFormData({
        categoryId: activeCats[0]?.id.toString() || "",
        amount: "",
        description: "",
        expenseDate: new Date().toISOString().substring(0, 10),
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedExpense(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.categoryId || !formData.amount || Number(formData.amount) <= 0) {
      setToast({ message: "Please fill all required fields correctly.", type: "error" });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        categoryId: Number(formData.categoryId),
        amount: Number(formData.amount),
        description: formData.description || null,
        expenseDate: formData.expenseDate ? new Date(formData.expenseDate).toISOString() : undefined,
      };

      if (selectedExpense) {
        // Edit Expense
        const response = await api.put(`/api/expense/${selectedExpense.id}`, payload);
        if (response.data && response.data.type === "success") {
          setToast({ message: "Expense updated successfully.", type: "success" });
          fetchExpenses();
          closeModal();
        }
      } else {
        // Create Expense
        const response = await api.post("/api/expense", payload);
        if (response.data && response.data.type === "success") {
          setToast({ message: "Expense logged successfully.", type: "success" });
          fetchExpenses();
          closeModal();
        }
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to save expense.", type: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense record?")) return;
    try {
      const response = await api.delete(`/api/expense/${id}`);
      if (response.data?.type === "success") {
        setToast({ message: "Expense record deleted successfully.", type: "success" });
        fetchExpenses();
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to delete expense record.", type: "error" });
    }
  };

  // Expense Category Modal Handlers
  const openCatModal = (cat = null) => {
    if (cat) {
      setSelectedCatForEdit(cat);
      setCatName(cat.name);
    } else {
      setSelectedCatForEdit(null);
      setCatName("");
    }
    setIsCatModalOpen(true);
  };

  const closeCatModal = () => {
    setIsCatModalOpen(false);
    setSelectedCatForEdit(null);
    setCatName("");
  };

  const handleCatSubmit = async (e) => {
    e.preventDefault();
    if (!catName.trim()) return;

    try {
      setCatSubmitting(true);
      if (selectedCatForEdit) {
        // Edit category name
        const response = await api.put(`/api/expense-category/${selectedCatForEdit.id}`, { name: catName });
        if (response.data?.type === "success") {
          setToast({ message: "Category updated successfully.", type: "success" });
          fetchCategories();
          closeCatModal();
        }
      } else {
        // Create category
        const response = await api.post("/api/expense-category", { name: catName });
        if (response.data?.type === "success") {
          setToast({ message: "Category created successfully.", type: "success" });
          fetchCategories();
          closeCatModal();
        }
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to save category.", type: "error" });
    } finally {
      setCatSubmitting(false);
    }
  };

  const handleToggleCatStatus = async (id, currentStatus) => {
    const nextStatus = !currentStatus;
    if (!window.confirm(`Are you sure you want to ${nextStatus ? "activate" : "deactivate"} this expense category?`)) return;
    try {
      let response;
      if (nextStatus){
        response = await api.put(`/api/expense-category/${id}/activate`, { isActive: nextStatus });
      } else {
        response = await api.delete(`/api/expense-category/${id}`, { isActive: nextStatus });7
      }
      if (response.data?.type === "success") {
        setToast({ message: `Expense category ${nextStatus ? "activated" : "deactivated"} successfully.`, type: "success" });
        fetchCategories();
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to toggle category status.", type: "error" });
    }
  };

  const activeCategoriesOnly = categories.filter(c => c.isActive);

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
          <h1 className="text-2xl font-bold tracking-tight">Business Expenses</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Log overhead costs (fuel, wages, shop utilities) and evaluate net profitability.
          </p>
        </div>
        {activeSubTab === "expenses" ? (
          <button
            onClick={() => openModal()}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 active:scale-95 transition-all duration-150"
          >
            <Plus size={16} className="mr-2" /> Log Expense
          </button>
        ) : (
          <button
            onClick={() => openCatModal()}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 active:scale-95 transition-all duration-150"
          >
            <Plus size={16} className="mr-2" /> Add Category
          </button>
        )}
      </div>

      {/* Navigation Subtabs */}
      <div className="border-b border-slate-200 dark:border-slate-800">
        <nav className="flex space-x-8 text-sm font-medium">
          <button
            onClick={() => { setActiveSubTab("expenses"); }}
            className={`py-4 border-b-2 px-1 transition-all ${
              activeSubTab === "expenses"
                ? "border-sky-600 text-sky-600 dark:text-sky-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Overhead Expenses Log
          </button>
          <button
            onClick={() => { setActiveSubTab("categories"); }}
            className={`py-4 border-b-2 px-1 transition-all ${
              activeSubTab === "categories"
                ? "border-sky-600 text-sky-600 dark:text-sky-400 font-bold"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            Expense Categories
          </button>
        </nav>
      </div>

      {/* Expenses Log Tab View */}
      {activeSubTab === "expenses" && (
        <>
          {/* Filters */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center">
            {/* Search */}
            <div className="w-full md:w-72 flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
              <Search className="text-slate-400 mr-2 flex-shrink-0" size={16} />
              <input
                type="text"
                placeholder="Search descriptions..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full text-sm bg-transparent outline-none border-none focus:ring-0 placeholder-slate-400 text-slate-900 dark:text-white"
              />
            </div>

            {/* Category filter */}
            <div className="w-full md:w-56 flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
              <Landmark className="text-slate-400 mr-2 flex-shrink-0" size={14} />
              <select
                value={selectedCategory}
                onChange={(e) => { setSelectedCategory(e.target.value); setPage(1); }}
                className="w-full text-sm bg-transparent border-none outline-none focus:ring-0 text-slate-700 dark:text-slate-350"
              >
                <option value="" className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white">All Categories</option>
                {activeCategoriesOnly.map((c) => (
                  <option key={c.id} value={c.id} className="bg-white dark:bg-slate-950 text-slate-900 dark:text-white">{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : expenses.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <TrendingDown className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={40} />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No expenses logged</h3>
              <p className="text-sm text-slate-400 mt-1">Log fuel, salaries or utility bills to keep financial reporting complete.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        <th className="px-6 py-4">Expense Date</th>
                        <th className="px-6 py-4">Category</th>
                        <th className="px-6 py-4">Description</th>
                        <th className="px-6 py-4">Logged By</th>
                        <th className="px-6 py-4 text-right">Amount (PKR)</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                      {expenses.map((exp) => (
                        <tr key={exp.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                            <span className="flex items-center">
                              <Calendar size={12} className="mr-1.5" />
                              {new Date(exp.expenseDate).toLocaleDateString()}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-950 dark:text-white capitalize">
                            {exp.category?.name}
                          </td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                            {exp.description || <span className="italic text-slate-450">No notes</span>}
                          </td>
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                            {exp.createdBy?.name || "System"}
                          </td>
                          <td className="px-6 py-4 text-right font-bold text-rose-600 dark:text-rose-400">
                            Rs. {Number(exp.amount).toFixed(2)}
                          </td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <button
                              onClick={() => openModal(exp)}
                              className="inline-flex items-center p-1.5 text-slate-550 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(exp.id)}
                              className="inline-flex items-center p-1.5 text-slate-550 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
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
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-50 text-slate-700 dark:text-slate-300"
                    >
                      Previous
                    </button>
                    <button
                      disabled={page === totalPages}
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 disabled:opacity-50 text-slate-700 dark:text-slate-300"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Expense Categories Tab View */}
      {activeSubTab === "categories" && (
        <div className="space-y-6">
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
                  {categories.map((category) => (
                    <tr key={category.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">
                        #{category.id}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-955 dark:text-white capitalize">
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
                          onClick={() => handleToggleCatStatus(category.id, category.isActive)}
                          className={`inline-flex items-center px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                            category.isActive
                              ? "text-rose-600 hover:bg-rose-50 border-rose-200 dark:border-rose-900/40 dark:hover:bg-rose-950/20"
                              : "text-emerald-600 hover:bg-emerald-50 border-emerald-200 dark:border-emerald-900/40 dark:hover:bg-emerald-950/20"
                          }`}
                        >
                          {category.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          onClick={() => openCatModal(category)}
                          className="inline-flex items-center p-1.5 text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Expense Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {selectedExpense ? "Update Overhead Expense" : "Log New Expense"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                All logged overhead items deduct immediately from business revenue evaluations.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Expense Category *</label>
                <select
                  name="categoryId"
                  value={formData.categoryId}
                  onChange={handleInputChange}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm font-semibold"
                >
                  <option value="" disabled className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">Select Category</option>
                  {activeCategoriesOnly.map((c) => (
                    <option key={c.id} value={c.id} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Amount (PKR) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    name="amount"
                    value={formData.amount}
                    onChange={handleInputChange}
                    placeholder="0.00"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm font-semibold"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Date</label>
                  <input
                    type="date"
                    required
                    name="expenseDate"
                    value={formData.expenseDate}
                    onChange={handleInputChange}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Description / Notes</label>
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  placeholder="e.g. Fuel delivery van No. 1"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
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
                  className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md shadow-sky-500/20 disabled:bg-sky-850 transition-colors"
                >
                  {submitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Receipt size={14} className="mr-2" />
                  )}
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Expense Category Add/Edit Modal */}
      {isCatModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {selectedCatForEdit ? "Update Expense Category" : "Add Expense Category"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Define the overhead group title (e.g. Wages, Utility Bills, Rent).
              </p>
            </div>

            <form onSubmit={handleCatSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Category Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office Stationery"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm font-semibold"
                />
              </div>

              <div className="flex space-x-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={closeCatModal}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={catSubmitting}
                  className="flex items-center px-4 py-2 text-sm font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md shadow-sky-500/20 disabled:bg-sky-850 transition-colors"
                >
                  {catSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Check size={14} className="mr-2" />
                  )}
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
