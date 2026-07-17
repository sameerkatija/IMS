import React, { useState } from "react";
import { Link } from "react-router-dom";
import api from "../services/api";
import { KeyRound, User, Lock, AlertCircle, CheckCircle } from "lucide-react";

const ForgotPassword = () => {
  const [username, setUsername] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await api.post("/api/auth/forgot-password", {
        username,
        secretKey,
        newPassword
      });

      if (response.data && response.data.type === "success") {
        setSuccess("Password updated successfully. You can now log in.");
        setUsername("");
        setSecretKey("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setError(response.data?.message || "Failed to update password.");
      }
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to establish connection to authentication service.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 px-4 select-none">
      <div className="w-full max-w-md p-8 space-y-6 bg-slate-950/40 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-white tracking-wide">Reset Password</h1>
          <p className="mt-2 text-sm text-slate-400">Use your username and private secret key to update your password.</p>
        </div>

        {error && (
          <div className="flex items-start p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
            <AlertCircle className="mr-2 flex-shrink-0 mt-0.5" size={16} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm">
            <CheckCircle className="mr-2 flex-shrink-0 mt-0.5" size={16} />
            <span>{success}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Username</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <User size={18} />
              </span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter username"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-white placeholder-slate-500 rounded-xl outline-none transition-all duration-200 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Admin Key</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <KeyRound size={18} />
              </span>
              <input
                type="password"
                required
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="Enter Key provided by Admin"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-white placeholder-slate-500 rounded-xl outline-none transition-all duration-200 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">New Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock size={18} />
              </span>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-white placeholder-slate-500 rounded-xl outline-none transition-all duration-200 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Confirm New Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock size={18} />
              </span>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-white placeholder-slate-500 rounded-xl outline-none transition-all duration-200 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center w-full py-3 px-4 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 text-white font-medium rounded-xl shadow-lg shadow-sky-500/20 active:scale-[0.99] transition-all duration-200 text-sm"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Update Password"
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <Link
            to="/login"
            className="text-xs font-semibold text-sky-400 hover:text-sky-300 hover:underline transition-colors"
          >
            Back to Login Screen
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
