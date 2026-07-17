import React, { useState, useEffect } from "react";
import api from "../services/api";
import { User, KeyRound, ShieldAlert, CheckCircle, XCircle, Clock } from "lucide-react";
import Toast from "../components/Toast";

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get("/api/user");
      if (response.data && response.data.type === "success") {
        setUsers(response.data.data);
      } else {
        setError("Failed to fetch user list.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to establish database connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleStatus = async (id, newStatus) => {
    if (!window.confirm(`Are you sure you want to ${newStatus ? "activate" : "suspend"} this user account?`)) return;
    try {
      const response = await api.put(`/api/user/${id}`, { isActive: newStatus });
      if (response.data && response.data.type === "success") {
        setToast({ message: response.data.message, type: "success" });
        fetchUsers();
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "Failed to update user status.", type: "error" });
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setToast({ message: "Password must be at least 8 characters.", type: "error" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setToast({ message: "Passwords do not match.", type: "error" });
      return;
    }

    try {
      setResetLoading(true);
      const response = await api.post(`/api/user/${selectedUser.id}/reset-password`, { newPassword });
      if (response.data && response.data.type === "success") {
        setToast({ message: `Password for ${selectedUser.name} reset successfully.`, type: "success" });
        setSelectedUser(null);
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setToast({ message: response.data?.message || "Password reset failed.", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setToast({ message: err.response?.data?.message || "An error occurred.", type: "error" });
    } finally {
      setResetLoading(false);
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage system operators, review active sessions, and reset passwords.
          </p>
        </div>
      </div>

      {error ? (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-900/50">
          {error}
        </div>
      ) : loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Username</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Last Login</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-sm">
                {users.map((userItem) => (
                  <tr key={userItem.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20">
                    <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                      {userItem.name}
                    </td>
                    <td className="px-6 py-4">{userItem.username}</td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                      {userItem.email || <span className="italic text-slate-400">No email</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        userItem.role === "ADMIN" 
                          ? "bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border border-sky-200 dark:border-sky-900/40"
                          : "bg-slate-50 text-slate-700 dark:bg-slate-900/40 dark:text-slate-300 border border-slate-200 dark:border-slate-800"
                      }`}>
                        {userItem.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {userItem.isActive ? (
                        <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 text-xs">
                          <CheckCircle size={14} className="mr-1" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-slate-400 text-xs">
                          <XCircle size={14} className="mr-1" /> Suspended
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400 text-xs">
                      {userItem.lastLoginAt ? (
                        <span className="flex items-center">
                          <Clock size={12} className="mr-1.5" />
                          {new Date(userItem.lastLoginAt).toLocaleString()}
                        </span>
                      ) : (
                        <span className="italic text-slate-400">Never</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => handleToggleStatus(userItem.id, !userItem.isActive)}
                        className={`inline-flex items-center px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                          userItem.isActive
                            ? "text-rose-600 hover:bg-rose-50 border-rose-200 dark:border-rose-900/40 dark:hover:bg-rose-950/20"
                            : "text-emerald-600 hover:bg-emerald-50 border-emerald-200 dark:border-emerald-900/40 dark:hover:bg-emerald-950/20"
                        }`}
                      >
                        {userItem.isActive ? "Suspend" : "Activate"}
                      </button>
                      <button
                        onClick={() => setSelectedUser(userItem)}
                        className="inline-flex items-center px-2.5 py-1.5 text-xs font-semibold text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                      >
                        <KeyRound size={12} className="mr-1.5" />
                        Reset PW
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Reset Password</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Setting new credentials for <strong className="text-slate-700 dark:text-slate-300">{selectedUser.name}</strong> ({selectedUser.username}).
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Min 8 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm transition-all duration-200"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Repeat new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-xl focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-none text-sm transition-all duration-200"
                />
              </div>

              <div className="flex space-x-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedUser(null);
                    setNewPassword("");
                    setConfirmPassword("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex items-center px-4 py-2 text-sm font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-md shadow-sky-500/20 disabled:bg-sky-800 transition-colors"
                >
                  {resetLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <KeyRound size={14} className="mr-2" />
                  )}
                  Save New Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
