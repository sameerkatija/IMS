import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import { UserPlus, User, Lock, Mail, ShieldAlert, Key, AlertCircle } from "lucide-react";

const Signup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    role: "STAFF",
    registrationSecret: ""
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      setSubmitting(false);
      return;
    }

    try {
      const payload = {
        name: formData.name,
        username: formData.username,
        email: formData.email || undefined,
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        role: formData.role,
        registrationSecret: formData.registrationSecret
      };

      const response = await api.post("/api/auth/register", payload);
      
      if (response.data && response.data.type === "success") {
        setSuccess("Registration completed successfully! Redirecting to login...");
        setTimeout(() => {
          navigate("/login");
        }, 2000);
      } else {
        setError(response.data?.message || "Registration failed.");
      }
    } catch (err) {
      console.error(err);
      if (err.response?.data?.fieldErrors) {
        // Collect field errors from Zod
        const fields = err.response.data.fieldErrors;
        const messages = Object.keys(fields).map(key => `${key}: ${fields[key].join(", ")}`);
        setError(messages.join(" | "));
      } else {
        setError(err.response?.data?.message || "Failed to establish server connection.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 px-4 py-8 select-none">
      <div className="w-full max-w-lg p-8 space-y-6 bg-slate-950/40 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-white tracking-wide">Register Account</h1>
          <p className="mt-2 text-sm text-slate-400">Create a secure system operator user</p>
        </div>

        {error && (
          <div className="flex items-start p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
            <AlertCircle className="mr-2 flex-shrink-0 mt-0.5" size={16} />
            <span className="break-words">{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-start p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm">
            <AlertCircle className="mr-2 flex-shrink-0 mt-0.5" size={16} />
            <span>{success}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Full Name</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <User size={16} />
                </span>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter full name"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-white placeholder-slate-500 rounded-xl outline-none text-sm transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Username</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <User size={16} />
                </span>
                <input
                  type="text"
                  name="username"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Choose username"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-white placeholder-slate-500 rounded-xl outline-none text-sm transition-all duration-200"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Email (Optional)</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Mail size={16} />
              </span>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="operator@company.com"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-white placeholder-slate-500 rounded-xl outline-none text-sm transition-all duration-200"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Min 8 characters"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-white placeholder-slate-500 rounded-xl outline-none text-sm transition-all duration-200"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Confirm Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  name="confirmPassword"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repeat password"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-white placeholder-slate-500 rounded-xl outline-none text-sm transition-all duration-200"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Role Type</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <ShieldAlert size={16} />
                </span>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-white rounded-xl outline-none text-sm transition-all duration-200 appearance-none"
                >
                  <option value="STAFF">STAFF (Inventory Operator)</option>
                  <option value="ADMIN">ADMIN (Full Authority)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1">Registration Secret</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                  <Key size={16} />
                </span>
                <input
                  type="password"
                  name="registrationSecret"
                  required
                  value={formData.registrationSecret}
                  onChange={handleChange}
                  placeholder="Server key required"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-white placeholder-slate-500 rounded-xl outline-none text-sm transition-all duration-200"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center w-full py-3 px-4 mt-4 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 text-white font-medium rounded-xl shadow-lg shadow-sky-500/20 active:scale-[0.99] transition-all duration-200"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus className="mr-2" size={18} />
                Register Account
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="text-xs text-slate-500">
            Already have an account?{" "}
            <Link to="/login" className="text-sky-400 hover:text-sky-300 font-semibold transition-colors">
              Sign In Here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Signup;
