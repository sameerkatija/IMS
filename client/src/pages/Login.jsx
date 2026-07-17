import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import api from "../services/api";
import { LogIn, User, Lock, AlertCircle } from "lucide-react";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const response = await api.post("/api/auth/login", { username, password });
      
      // Token is in authorization header
      const token = response.headers["authorization"] || response.headers["Authorization"];
      
      if (token) {
        const cleanedToken = token.startsWith("Bearer ") ? token.substring(7) : token;
        login(cleanedToken);
        navigate("/");
      } else {
        setError("Login succeeded but no session token was issued by the server.");
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || 
        "Network connection failed. Make sure the backend server is running."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 px-4 select-none">
      <div className="w-full max-w-md p-8 space-y-6 bg-slate-950/40 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold text-white tracking-wide">Sameer Distributors</h1>
          <p className="mt-2 text-sm text-slate-400">Inventory & Ledger Management System</p>
        </div>

        {error && (
          <div className="flex items-start p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
            <AlertCircle className="mr-2 flex-shrink-0 mt-0.5" size={16} />
            <span>{error}</span>
          </div>
        )}

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Username</label>
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
                className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-white placeholder-slate-500 rounded-xl outline-none transition-all duration-200"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Password</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock size={18} />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-white placeholder-slate-500 rounded-xl outline-none transition-all duration-200"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex items-center justify-center w-full py-3.5 px-4 bg-sky-600 hover:bg-sky-500 disabled:bg-sky-800 text-white font-medium rounded-xl shadow-lg shadow-sky-500/20 active:scale-[0.99] transition-all duration-200"
          >
            {submitting ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="mr-2" size={18} />
                Sign In
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6 space-y-2">
          <p className="text-xs text-slate-500">
            Need an account?{" "}
            <Link to="/signup" className="text-sky-400 hover:text-sky-300 font-semibold transition-colors">
              Register Here
            </Link>
          </p>
          <p className="text-xs">
            <Link to="/forgot-password" className="text-sky-400 hover:text-sky-300 font-semibold transition-colors">
              Forgot Password?
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
