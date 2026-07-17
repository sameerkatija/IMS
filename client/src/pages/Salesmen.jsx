import React, { useState, useEffect } from "react";
import api from "../services/api";
import { UserCheck, Plus, Edit2, Search, Target, Award, Calendar, ChevronRight } from "lucide-react";
import Toast from "../components/Toast";

const Salesmen = () => {
  const [salesmen, setSalesmen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState("all");
  const [toast, setToast] = useState(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(10);

  // Salesman modal
  const [isSalesmanModalOpen, setIsSalesmanModalOpen] = useState(false);
  const [selectedSalesman, setSelectedSalesman] = useState(null);
  const [salesmanSubmitting, setSalesmanSubmitting] = useState(false);
  const [salesmanForm, setSalesmanForm] = useState({
    name: "",
    phone: ""
  });

  // Target modal
  const [isTargetModalOpen, setIsTargetModalOpen] = useState(false);
  const [targetSubmitting, setTargetSubmitting] = useState(false);
  const [targetSalesman, setTargetSalesman] = useState(null);
  const [targetForm, setTargetForm] = useState({
    month: new Date().toISOString().substring(0, 7), // YYYY-MM
    targetAmount: "",
    description: ""
  });

  // Achievement View
  const [viewingAchievementSalesman, setViewingAchievementSalesman] = useState(null);
  const [achievementMonth, setAchievementMonth] = useState(new Date().toISOString().substring(0, 7));
  const [achievementData, setAchievementData] = useState(null);
  const [achievementLoading, setAchievementLoading] = useState(false);

  const fetchSalesmen = async () => {
    try {
      setLoading(true);
      let queryParams = `?page=${page}&limit=${limit}`;
      if (search.trim()) queryParams += `&search=${encodeURIComponent(search)}`;
      if (isActiveFilter !== "all") queryParams += `&isActive=${isActiveFilter === "active"}`;

      const response = await api.get(`/api/salesman${queryParams}`);
      if (response.data && response.data.type === "success") {
        setSalesmen(response.data.data);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to load salesmen list.", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSalesmen();
  }, [page, search, isActiveFilter]);

  const handleSalesmanInputChange = (e) => {
    const { name, value } = e.target;
    setSalesmanForm({ ...salesmanForm, [name]: value });
  };

  const handleTargetInputChange = (e) => {
    const { name, value } = e.target;
    setTargetForm({ ...targetForm, [name]: value });
  };

  const openSalesmanModal = (salesman = null) => {
    if (salesman) {
      setSelectedSalesman(salesman);
      setSalesmanForm({
        name: salesman.name,
        phone: salesman.phone || ""
      });
    } else {
      setSelectedSalesman(null);
      setSalesmanForm({
        name: "",
        phone: ""
      });
    }
    setIsSalesmanModalOpen(true);
  };

  const closeSalesmanModal = () => {
    setIsSalesmanModalOpen(false);
    setSelectedSalesman(null);
  };

  const handleSalesmanSubmit = async (e) => {
    e.preventDefault();
    if (!salesmanForm.name.trim()) return;

    try {
      setSalesmanSubmitting(true);
      const payload = {
        name: salesmanForm.name,
        phone: salesmanForm.phone || null
      };

      let response;
      if (selectedSalesman) {
        response = await api.put(`/api/salesman/${selectedSalesman.id}`, payload);
      } else {
        response = await api.post("/api/salesman", payload);
      }

      if (response.data && response.data.type === "success") {
        setToast({
          message: selectedSalesman ? "Salesman details updated." : "New salesman registered successfully.",
          type: "success"
        });
        fetchSalesmen();
        closeSalesmanModal();
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to process salesman.", type: "error" });
    } finally {
      setSalesmanSubmitting(false);
    }
  };

  const toggleSalesmanStatus = async (salesmanItem) => {
    try {
      const payload = {
        name: salesmanItem.name,
        phone: salesmanItem.phone,
        isActive: !salesmanItem.isActive
      };
      const response = await api.put(`/api/salesman/${salesmanItem.id}`, payload);
      if (response.data && response.data.type === "success") {
        setToast({ message: `Salesman status set to ${!salesmanItem.isActive ? "Active" : "Inactive"}.`, type: "success" });
        fetchSalesmen();
      }
    } catch (err) {
      console.error(err);
      setToast({ message: "Failed to update status.", type: "error" });
    }
  };

  const openTargetModal = (salesmanItem) => {
    setTargetSalesman(salesmanItem);
    setTargetForm({
      month: new Date().toISOString().substring(0, 7),
      targetAmount: "",
      description: ""
    });
    setIsTargetModalOpen(true);
  };

  const closeTargetModal = () => {
    setIsTargetModalOpen(false);
    setTargetSalesman(null);
  };

  const handleTargetSubmit = async (e) => {
    e.preventDefault();
    if (!targetForm.targetAmount || Number(targetForm.targetAmount) <= 0) {
      setToast({ message: "Please enter a valid target amount.", type: "error" });
      return;
    }

    try {
      setTargetSubmitting(true);
      const response = await api.post(`/api/sales-target/salesman/${targetSalesman.id}/target`, {
        salesmanId: targetSalesman.id,
        month: targetForm.month,
        targetAmount: Number(targetForm.targetAmount),
        description: targetForm.description || null
      });

      if (response.data && response.data.type === "success") {
        setToast({ message: `Target set for ${targetSalesman.name} successfully.`, type: "success" });
        closeTargetModal();
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to set salesman target.", type: "error" });
    } finally {
      setTargetSubmitting(false);
    }
  };

  const loadAchievement = async (salesmanItem, customMonth = null) => {
    const activeMonth = customMonth || achievementMonth;
    try {
      setAchievementLoading(true);
      setViewingAchievementSalesman(salesmanItem);
      if (customMonth) setAchievementMonth(customMonth);
      
      const response = await api.get(`/api/sales-target/salesman/${salesmanItem.id}/achievement?month=${activeMonth}`);
      if (response.data && response.data.type === "success") {
        setAchievementData(response.data.data);
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Error fetching achievements.", type: "error" });
      setAchievementData(null);
    } finally {
      setAchievementLoading(false);
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
          <h1 className="text-2xl font-bold tracking-tight">Salesmen Directory</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Register distribution salesmen, establish monthly revenue goals, and track achievements.
          </p>
        </div>
        <button
          onClick={() => openSalesmanModal()}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-sm font-semibold rounded-xl shadow-md shadow-sky-500/20 active:scale-95 transition-all duration-150"
        >
          <Plus size={16} className="mr-2" /> Add Salesman
        </button>
      </div>

      {/* Search and filter options */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="w-full md:w-72 flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
          <Search className="text-slate-400 mr-2 flex-shrink-0" size={16} />
          <input
            type="text"
            placeholder="Search salesman by name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full text-sm bg-transparent outline-none border-none focus:ring-0 placeholder-slate-400"
          />
        </div>

        <div className="w-full md:w-48 flex items-center bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2">
          <select
            value={isActiveFilter}
            onChange={(e) => { setIsActiveFilter(e.target.value); setPage(1); }}
            className="w-full text-sm bg-transparent border-none outline-none focus:ring-0 text-slate-700 dark:text-slate-300"
          >
            <option value="all">All Salesmen</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main List */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="flex justify-center items-center py-20">
              <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : salesmen.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <UserCheck className="mx-auto text-slate-300 dark:text-slate-700 mb-3" size={40} />
              <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No salesmen found</h3>
              <p className="text-sm text-slate-400 mt-1">Register a salesman to tag invoice orders.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        <th className="px-6 py-4">Salesman</th>
                        <th className="px-6 py-4">Phone</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                      {salesmen.map((salesmanItem) => (
                        <tr
                          key={salesmanItem.id}
                          className={`hover:bg-slate-50/50 dark:hover:bg-slate-900/20 cursor-pointer ${
                            viewingAchievementSalesman?.id === salesmanItem.id ? "bg-sky-50/40 dark:bg-sky-950/20" : ""
                          }`}
                          onClick={() => loadAchievement(salesmanItem)}
                        >
                          <td className="px-6 py-4 font-medium text-slate-950 dark:text-white capitalize">
                            <div className="flex items-center">
                              {salesmanItem.name}
                              <ChevronRight size={14} className="ml-1.5 text-slate-400 lg:hidden" />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-500 dark:text-slate-400 font-mono text-xs">
                            {salesmanItem.phone || <span className="italic text-slate-400">None</span>}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <button
                              onClick={(e) => { e.stopPropagation(); toggleSalesmanStatus(salesmanItem); }}
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer transition-colors ${
                                salesmanItem.isActive
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40"
                                  : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              {salesmanItem.isActive ? "Active" : "Inactive"}
                            </button>
                          </td>
                          <td className="px-6 py-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => openSalesmanModal(salesmanItem)}
                              className="inline-flex items-center p-1.5 text-slate-500 hover:text-sky-600 dark:hover:text-sky-400 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              disabled={!salesmanItem.isActive}
                              onClick={() => openTargetModal(salesmanItem)}
                              className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-lg border border-sky-200 dark:border-sky-900/40 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                            >
                              <Target size={12} className="mr-1" /> Set Goal
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
        </div>

        {/* Sidebar Achievement Details Card */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm h-fit">
          {!viewingAchievementSalesman ? (
            <div className="text-center py-10 text-slate-400">
              <Award size={36} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold">Select a salesman</p>
              <p className="text-xs mt-1">Review target progression parameters.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                <div>
                  <h3 className="font-bold text-slate-950 dark:text-white capitalize">
                    {viewingAchievementSalesman.name}
                  </h3>
                  <p className="text-xs text-slate-500">Goal progression dashboard</p>
                </div>
                <div className="flex items-center text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg px-2.5 py-1 text-slate-600 dark:text-slate-400">
                  <Calendar size={12} className="mr-1.5" />
                  <input
                    type="month"
                    value={achievementMonth}
                    onChange={(e) => loadAchievement(viewingAchievementSalesman, e.target.value)}
                    className="bg-transparent border-none outline-none p-0 w-24 text-xs cursor-pointer font-semibold"
                  />
                </div>
              </div>

              {achievementLoading ? (
                <div className="flex justify-center items-center py-10">
                  <div className="w-6 h-6 border-3 border-sky-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : !achievementData ? (
                <p className="text-sm text-center text-slate-400 py-6">No performance statistics loaded.</p>
              ) : (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Target Set</p>
                      <p className="text-sm font-bold mt-0.5">Rs. {Number(achievementData.targetAmount).toLocaleString()}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-950 p-3 rounded-xl border border-slate-200/50 dark:border-slate-800/50">
                      <p className="text-[10px] text-slate-400 uppercase font-semibold">Net Sales</p>
                      <p className="text-sm font-bold mt-0.5 text-sky-600">Rs. {Number(achievementData.actualSales).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-500">Goal Achieved</span>
                      <span className={achievementData.achievedPercent >= 100 ? "text-emerald-600" : "text-sky-600"}>
                        {achievementData.achievedPercent !== null ? `${achievementData.achievedPercent}%` : "0% (No target)"}
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div
                        style={{ width: `${Math.min(achievementData.achievedPercent || 0, 100)}%` }}
                        className={`h-full rounded-full transition-all duration-300 ${
                          achievementData.achievedPercent >= 100
                            ? "bg-emerald-500 shadow-sm shadow-emerald-500/30"
                            : "bg-sky-500 shadow-sm shadow-sky-500/30"
                        }`}
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Gross Monthly Invoices:</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        Rs. {Number(achievementData.grossSales).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Returned Merchandise:</span>
                      <span className="font-semibold text-rose-500">
                        Rs. {Number(achievementData.returns).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Salesman Modal */}
      {isSalesmanModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {selectedSalesman ? "Edit Salesman Details" : "Register Salesman"}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Salesmen are login-less records used to tag invoices and compute performance.
              </p>
            </div>

            <form onSubmit={handleSalesmanSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Salesman Name *</label>
                <input
                  type="text"
                  required
                  name="name"
                  value={salesmanForm.name}
                  onChange={handleSalesmanInputChange}
                  placeholder="e.g. Asif Ali"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Phone Number (Optional)</label>
                <input
                  type="text"
                  name="phone"
                  value={salesmanForm.phone}
                  onChange={handleSalesmanInputChange}
                  placeholder="e.g. 03001234567"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                />
              </div>

              <div className="flex space-x-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={closeSalesmanModal}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={salesmanSubmitting}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md shadow-sky-500/20 disabled:bg-sky-800 transition-colors"
                >
                  {salesmanSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Plus size={14} className="mr-2" />
                  )}
                  {selectedSalesman ? "Update Salesman" : "Register Salesman"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Goal Modal */}
      {isTargetModalOpen && targetSalesman && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Set Sales Goal
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Assign a monthly sales goal target for <strong>{targetSalesman.name}</strong>.
              </p>
            </div>

            <form onSubmit={handleTargetSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Target Month</label>
                  <input
                    type="month"
                    required
                    name="month"
                    value={targetForm.month}
                    onChange={handleTargetInputChange}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Target Amount (PKR) *</label>
                  <input
                    type="number"
                    required
                    name="targetAmount"
                    value={targetForm.targetAmount}
                    onChange={handleTargetInputChange}
                    placeholder="e.g. 500000"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase block mb-1">Goal Description (Optional)</label>
                <input
                  type="text"
                  name="description"
                  value={targetForm.description}
                  onChange={handleTargetInputChange}
                  placeholder="e.g. Q3 volume growth targets"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm"
                />
              </div>

              <div className="flex space-x-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={closeTargetModal}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={targetSubmitting}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md shadow-sky-500/20 disabled:bg-sky-800 transition-colors"
                >
                  {targetSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Target size={14} className="mr-2" />
                  )}
                  Save Sales Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Salesmen;
