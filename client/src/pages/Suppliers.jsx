import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { Truck, Plus, Edit2, Search, FileText, Phone, MapPin } from "lucide-react";
import Toast from "../components/Toast";

const Suppliers = () => {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState("all");
  const [toast, setToast] = useState(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);
  
  // Modal fields
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: ""
  });

  const fetchSuppliers = async () => {
    try {
      setLoading(true);
      let queryParams = `?page=${page}&limit=${limit}`;
      if (search.trim()) queryParams += `&search=${encodeURIComponent(search)}`;
      if (isActiveFilter !== "all") queryParams += `&isActive=${isActiveFilter === "active"}`;
      
      const response = await api.get(`/api/supplier${queryParams}`);
      if (response.data && response.data.type === "success") {
        setSuppliers(response.data.data);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load suppliers.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliers();
  }, [page, search, isActiveFilter]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const openModal = (supplier = null) => {
    if (supplier) {
      setSelectedSupplier(supplier);
      setFormData({
        name: supplier.name,
        phone: supplier.phone || "",
        address: supplier.address || ""
      });
    } else {
      setSelectedSupplier(null);
      setFormData({
        name: "",
        phone: "",
        address: ""
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedSupplier(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setToast({ message: "Supplier name is required.", type: "error" });
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        name: formData.name,
        phone: formData.phone || null,
        address: formData.address || null
      };

      let response;
      if (selectedSupplier) {
        response = await api.put(`/api/supplier/${selectedSupplier.id}`, payload);
      } else {
        response = await api.post("/api/supplier", payload);
      }

      if (response.data && response.data.type === "success") {
        setToast({
          message: selectedSupplier ? "Supplier updated successfully." : "Supplier registered successfully.",
          type: "success"
        });
        fetchSuppliers();
        closeModal();
      }
    } catch (err) {
      console.error(err);
      setToast({
        message: err.response?.data?.message || "Failed to save supplier.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (supplier) => {
    try {
      const payload = {
        name: supplier.name,
        phone: supplier.phone,
        address: supplier.address,
        isActive: !supplier.isActive
      };
      const response = await api.put(`/api/supplier/${supplier.id}`, payload);
      if (response.data && response.data.type === "success") {
        setToast({ message: `Supplier ${!supplier.isActive ? "activated" : "deactivated"} successfully.`, type: "success" });
        fetchSuppliers();
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to update supplier status.", type: "error" });
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
          <h1 className="text-2xl font-bold tracking-tight">Suppliers Database</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Register FMCG manufacturer/importer contacts and track payable accounts.
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 active:scale-95 transition-all duration-150"
        >
          <Plus size={16} className="mr-2" /> Add Supplier
        </button>
      </div>

      {/* Filter and search */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        {/* Search */}
        <div className="w-full md:w-72 flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
          <Search className="text-slate-400 mr-2 flex-shrink-0" size={16} />
          <input
            type="text"
            placeholder="Search name or phone..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full text-sm bg-transparent outline-none border-none focus:ring-0 placeholder-slate-400"
          />
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

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : suppliers.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <Truck className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={40} />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No suppliers found</h3>
          <p className="text-sm text-slate-400 mt-1">Get started by registering your first supplier company.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4">Supplier ID</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Contact Info</th>
                    <th className="px-6 py-4 text-right">Outstanding Balance</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {suppliers.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">
                        #{s.id}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-950 dark:text-white capitalize">
                        {s.name}
                      </td>
                      <td className="px-6 py-4">
                        {s.phone && (
                          <div className="flex items-center text-xs text-slate-600 dark:text-slate-400">
                            <Phone size={12} className="mr-1 flex-shrink-0" /> {s.phone}
                          </div>
                        )}
                        {s.address && (
                          <div className="flex items-center text-xs text-slate-400 mt-0.5">
                            <MapPin size={12} className="mr-1 flex-shrink-0" /> {s.address}
                          </div>
                        )}
                        {!s.phone && !s.address && <span className="text-slate-400 italic text-xs">No details</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-bold ${
                          Number(s.balance) > 0 
                            ? "text-amber-600 dark:text-amber-400" 
                            : "text-slate-600 dark:text-slate-400"
                        }`}>
                          Rs. {Number(s.balance).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => toggleStatus(s)}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                            s.isActive 
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {s.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => openModal(s)}
                          className="inline-flex items-center p-1.5 text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => navigate(`/reports?tab=supplier-ledger&supplierId=${s.id}`)}
                          className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-lg border border-sky-200 dark:border-sky-900/40 transition-colors"
                        >
                          <FileText size={12} className="mr-1" /> Ledger
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

      {/* Supplier Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {selectedSupplier ? "Edit Supplier Details" : "Register Supplier Profile"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Establish a supply company record to catalog inventory purchase invoices.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Supplier/Company Name *</label>
                <input
                  type="text"
                  required
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Shield FMCG Distributors"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Phone Number (Optional)</label>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="e.g. 02131234567"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Company Address (Optional)</label>
                <textarea
                  name="address"
                  rows={3}
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="e.g. Plot # 12, Industrial Area, Karachi"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
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
                  {selectedSupplier ? "Update Supplier" : "Register Supplier"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
