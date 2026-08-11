import React, { useState, useEffect } from "react";
import api from "../services/api";

export default function AccountingPeriods() {
  const [periods, setPeriods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState("");

  // Modal State for creating new period
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchPeriods = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get("/api/system/accounting-periods");
      setPeriods(res.data.periods || []);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to fetch accounting periods.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPeriods();
  }, []);

  const handleLock = async (id, name) => {
    if (!window.confirm(`Are you sure you want to CLOSE & LOCK the accounting period '${name}'? No further transactions or edits will be allowed within this date range.`)) {
      return;
    }
    try {
      setError(null);
      await api.put(`/api/system/accounting-periods/${id}/lock`);
      setSuccessMsg(`Period '${name}' locked successfully.`);
      fetchPeriods();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to lock accounting period.");
    }
  };

  const handleUnlock = async (id, name) => {
    if (!window.confirm(`Admin Override: Are you sure you want to RE-OPEN the accounting period '${name}'?`)) {
      return;
    }
    try {
      setError(null);
      await api.put(`/api/system/accounting-periods/${id}/unlock`);
      setSuccessMsg(`Period '${name}' re-opened successfully.`);
      fetchPeriods();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to unlock accounting period.");
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.startDate || !formData.endDate) {
      setError("Please fill in all fields.");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await api.post("/api/system/accounting-periods", formData);
      setSuccessMsg(`Accounting period '${formData.name}' created successfully.`);
      setShowCreateModal(false);
      setFormData({ name: "", startDate: "", endDate: "" });
      fetchPeriods();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create accounting period.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            Accounting Period Locks
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage fiscal calendar periods and lock closed months to enforce financial period closing compliance.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center justify-center px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg text-sm transition-colors shadow-sm"
        >
          + New Accounting Period
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800/50 text-emerald-800 dark:text-emerald-300 rounded-lg text-sm flex items-center justify-between">
          <span>{successMsg}</span>
          <button onClick={() => setSuccessMsg("")} className="font-bold ml-4">✕</button>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 dark:bg-rose-950/30 dark:border-rose-800/50 text-rose-800 dark:text-rose-300 rounded-lg text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold ml-4">✕</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            Loading accounting periods...
          </div>
        ) : periods.length === 0 ? (
          <div className="p-8 text-center text-slate-500 dark:text-slate-400">
            No accounting periods found. Click "+ New Accounting Period" to define your fiscal calendar.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold">
                <tr>
                  <th className="py-3.5 px-4">Period Name</th>
                  <th className="py-3.5 px-4">Start Date</th>
                  <th className="py-3.5 px-4">End Date</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Closed Timestamp</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {periods.map((period) => (
                  <tr key={period.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                    <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                      {period.name}
                    </td>
                    <td className="py-3.5 px-4">
                      {new Date(period.startDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4">
                      {new Date(period.endDate).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4">
                      {period.isClosed ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300">
                          🔒 CLOSED & LOCKED
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                          🟢 OPEN
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                      {period.closedAt ? new Date(period.closedAt).toLocaleString() : "—"}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {period.isClosed ? (
                        <button
                          onClick={() => handleUnlock(period.id, period.name)}
                          className="px-3 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-medium rounded transition-colors"
                        >
                          Unlock (Admin Override)
                        </button>
                      ) : (
                        <button
                          onClick={() => handleLock(period.id, period.name)}
                          className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white text-xs font-medium rounded transition-colors"
                        >
                          Close & Lock Period
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Period Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                New Fiscal Accounting Period
              </h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Period Name / Reference
                </label>
                <input
                  type="text"
                  placeholder="e.g. July 2026 or FY26 Q1"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500"
                  required
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  {submitting ? "Creating..." : "Save Period"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
