import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import { Users, Plus, Edit2, Search, FileText, Phone, MapPin, ShieldCheck } from "lucide-react";
import Toast from "../components/Toast";

const Customers = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState("all");
  const [balanceFilter, setBalanceFilter] = useState("all");
  const [toast, setToast] = useState(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);
  
  // Modal fields
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: ""
  });

  // Reconciliation modal state
  const [reconcileData, setReconcileData] = useState(null);
  const [isReconcileModalOpen, setIsReconcileModalOpen] = useState(false);
  const [reconcileLoading, setReconcileLoading] = useState(false);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      let queryParams = `?page=${page}&limit=${limit}`;
      if (search.trim()) queryParams += `&search=${encodeURIComponent(search)}`;
      if (isActiveFilter !== "all") queryParams += `&isActive=${isActiveFilter === "active"}`;
      if (balanceFilter !== "all") queryParams += `&balanceFilter=${balanceFilter}`;
      
      const response = await api.get(`/api/customer${queryParams}`);
      if (response.data && response.data.type === "success") {
        setCustomers(response.data.data);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load customers.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [page, search, isActiveFilter, balanceFilter]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const openModal = (customer = null) => {
    if (customer) {
      setSelectedCustomer(customer);
      setFormData({
        name: customer.name,
        phone: customer.phone || "",
        address: customer.address || ""
      });
    } else {
      setSelectedCustomer(null);
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
    setSelectedCustomer(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setToast({ message: "Customer name is required.", type: "error" });
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
      if (selectedCustomer) {
        response = await api.put(`/api/customer/${selectedCustomer.id}`, payload);
      } else {
        response = await api.post("/api/customer", payload);
      }

      if (response.data && response.data.type === "success") {
        setToast({
          message: selectedCustomer ? "Customer updated successfully." : "Customer registered successfully.",
          type: "success"
        });
        fetchCustomers();
        closeModal();
      }
    } catch (err) {
      console.error(err);
      setToast({
        message: err.response?.data?.message || "Failed to save customer.",
        type: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleStatus = async (customer) => {
    try {
      const payload = {
        name: customer.name,
        phone: customer.phone,
        address: customer.address,
        isActive: !customer.isActive
      };
      const response = await api.put(`/api/customer/${customer.id}`, payload);
      if (response.data && response.data.type === "success") {
        setToast({ message: `Customer ${!customer.isActive ? "activated" : "deactivated"} successfully.`, type: "success" });
        fetchCustomers();
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to update customer status.", type: "error" });
    }
  };

  const handleReconcile = async (customer) => {
    try {
      setReconcileLoading(true);
      const response = await api.get(`/api/customer/${customer.id}/reconcile`);
      if (response.data && response.data.type === "success") {
        setReconcileData(response.data.data);
        setIsReconcileModalOpen(true);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to reconcile customer ledger.", type: "error" });
    } finally {
      setReconcileLoading(false);
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
          <h1 className="text-2xl font-bold tracking-tight">Customers Database</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Register credit/cash accounts and track outstanding receivables.
          </p>
        </div>
        <button
          onClick={() => openModal()}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 active:scale-95 transition-all duration-150"
        >
          <Plus size={16} className="mr-2" /> Add Customer
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

        {/* Balance filter */}
        <div className="w-full md:w-56 flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
          <select
            value={balanceFilter}
            onChange={(e) => { setBalanceFilter(e.target.value); setPage(1); }}
            className="w-full text-sm bg-transparent border-none outline-none focus:ring-0 text-slate-700 dark:text-slate-300 font-medium"
          >
            <option value="all">All Balances</option>
            <option value="oweUs">Owes Us (Customer owes us)</option>
            <option value="weOwe">We Owe Them (Store Credit)</option>
            <option value="zero">Zero/Settled Balance</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
          <Users className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={40} />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No customers found</h3>
          <p className="text-sm text-slate-400 mt-1">Add details of a new retail customer account.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                    <th className="px-6 py-4">Customer ID</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Contact Info</th>
                    <th className="px-6 py-4 text-right">Outstanding Balance</th>
                    <th className="px-6 py-4 text-center">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                      <td className="px-6 py-4 font-mono text-xs text-slate-400">
                        #{c.id}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-950 dark:text-white capitalize">
                        {c.name}
                      </td>
                      <td className="px-6 py-4">
                        {c.phone && (
                          <div className="flex items-center text-xs text-slate-600 dark:text-slate-400">
                            <Phone size={12} className="mr-1 flex-shrink-0" /> {c.phone}
                          </div>
                        )}
                        {c.address && (
                          <div className="flex items-center text-xs text-slate-400 mt-0.5">
                            <MapPin size={12} className="mr-1 flex-shrink-0" /> {c.address}
                          </div>
                        )}
                        {!c.phone && !c.address && <span className="text-slate-400 italic text-xs">No details</span>}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className={`font-bold ${
                          Number(c.balance) > 0 
                            ? "text-rose-600 dark:text-rose-400" 
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}>
                          Rs. {Number(c.balance).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <button 
                          onClick={() => toggleStatus(c)}
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                            c.isActive 
                              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
                              : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                          }`}
                        >
                          {c.isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => openModal(c)}
                          className="inline-flex items-center p-1.5 text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          title="Edit Customer"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleReconcile(c)}
                          disabled={reconcileLoading}
                          className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-450 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-900/40 disabled:opacity-50 transition-colors"
                        >
                          <ShieldCheck size={12} className="mr-1" /> Reconcile
                        </button>
                        <button
                          onClick={() => navigate(`/reports?tab=customer-ledger&customerId=${c.id}`)}
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

      {/* Customer Form Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {selectedCustomer ? "Edit Customer Profile" : "Register Customer Account"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Cash sales do not require a profile, but credit transactions must map to a registered customer.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="e.g. Sameer distributors shop"
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
                  placeholder="e.g. 03217654321"
                  className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Address Details (Optional)</label>
                <textarea
                  name="address"
                  rows={3}
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="e.g. Shop # 4, Main Bazar, Lahore"
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
                  {selectedCustomer ? "Update Profile" : "Register Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reconciliation Modal */}
      {isReconcileModalOpen && reconcileData && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="text-amber-600" size={20} />
                  Ledger Reconciliation Audit
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Account details and transaction verification for <strong>{reconcileData.customerName}</strong>.
                </p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                reconcileData.inSync
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-450 border border-emerald-200 dark:border-emerald-900/40"
                  : "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-450 border border-rose-200 dark:border-rose-900/40"
              }`}>
                {reconcileData.inSync ? "In Sync" : "Drift Detected"}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-4 border border-slate-200 dark:border-slate-800 p-4 rounded-xl bg-slate-50 dark:bg-slate-950/40">
              <div className="text-center">
                <span className="text-xs text-slate-400 block">DB Balance</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">Rs. {Number(reconcileData.denormalizedBalance).toFixed(2)}</span>
              </div>
              <div className="text-center border-x border-slate-200 dark:border-slate-850">
                <span className="text-xs text-slate-400 block">Ledger Sum</span>
                <span className="text-sm font-bold text-slate-900 dark:text-white">Rs. {Number(reconcileData.ledgerSum).toFixed(2)}</span>
              </div>
              <div className="text-center">
                <span className="text-xs text-slate-400 block">Drift Balance</span>
                <span className={`text-sm font-bold ${Number(reconcileData.drift) !== 0 ? "text-rose-600 font-black" : "text-slate-900 dark:text-white"}`}>
                  Rs. {Number(reconcileData.drift).toFixed(2)}
                </span>
              </div>
            </div>

            {reconcileData.duplicateEntriesCount > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex flex-col gap-1">
                <strong>Potential Duplicates Found:</strong>
                <span>There are {reconcileData.duplicateEntriesCount} transaction logs that share identical amounts and timestamps. Check the ledger history sheet manually.</span>
              </div>
            )}

            {reconcileData.invalidReferences.length > 0 ? (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-rose-600 block">Broken Linkages / Broken Records:</span>
                <div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
                        <th className="p-2">Type</th>
                        <th className="p-2">ID</th>
                        <th className="p-2">Error Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                      {reconcileData.invalidReferences.map((ref, idx) => (
                        <tr key={idx} className="text-slate-500">
                          <td className="p-2 font-mono">{ref.type}</td>
                          <td className="p-2 font-mono">#{ref.id}</td>
                          <td className="p-2 text-rose-600">{ref.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-2 text-xs text-slate-400">
                ✓ No broken document references or ledger links detected.
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => { setIsReconcileModalOpen(false); setReconcileData(null); }}
                className="px-4 py-2 text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
              >
                Close Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
