import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  Tag,
  Package,
  Users,
  Truck,
  ShoppingCart,
  Receipt,
  CreditCard,
  UserCheck,
  TrendingDown,
  RotateCcw,
  BarChart3,
  KeyRound,
  LogOut,
  Menu,
  X,
  Sun,
  Moon,
  User
} from "lucide-react";

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem("theme") === "dark" || 
      (!("theme" in localStorage) && window.matchMedia("(prefers-color-scheme: dark)").matches);
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const navigationItems = [
    { name: "Dashboard", path: "/", icon: LayoutDashboard, roles: ["ADMIN", "STAFF"] },
    { name: "Categories", path: "/categories", icon: Tag, roles: ["ADMIN", "STAFF"] },
    { name: "Products", path: "/products", icon: Package, roles: ["ADMIN", "STAFF"] },
    { name: "Customers", path: "/customers", icon: Users, roles: ["ADMIN", "STAFF"] },
    { name: "Suppliers", path: "/suppliers", icon: Truck, roles: ["ADMIN", "STAFF"] },
    { name: "Purchases", path: "/purchases", icon: ShoppingCart, roles: ["ADMIN", "STAFF"] },
    { name: "Invoices", path: "/invoices", icon: Receipt, roles: ["ADMIN", "STAFF"] },
    { name: "Payments", path: "/payments", icon: CreditCard, roles: ["ADMIN", "STAFF"] },
    { name: "Salesmen & Targets", path: "/salesmen", icon: UserCheck, roles: ["ADMIN", "STAFF"] },
    { name: "Expenses", path: "/expenses", icon: TrendingDown, roles: ["ADMIN", "STAFF"] },
    { name: "Returns & Stock", path: "/returns", icon: RotateCcw, roles: ["ADMIN", "STAFF"] },
    { name: "Reports Center", path: "/reports", icon: BarChart3, roles: ["ADMIN", "STAFF"] },
    { name: "User Management", path: "/admin/users", icon: KeyRound, roles: ["ADMIN"] } // Admin-only route!
  ];

  const visibleItems = navigationItems.filter(item => item.roles.includes(user?.role));

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-white select-none">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-800">
        <span className="text-xl font-bold tracking-wider text-sky-400">Sameer Distributors</span>
        <button onClick={toggleDarkMode} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-yellow-400 dark:text-sky-300">
          {darkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${
                isActive
                  ? "bg-sky-600 text-white shadow-md shadow-sky-500/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Icon className="mr-3" size={18} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* User Section & Logout */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
            <User size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white truncate">{user?.name || "User Profile"}</p>
            <p className="text-xs text-slate-500 uppercase font-semibold">{user?.role || "Staff"}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500 hover:text-white rounded-xl transition-all duration-200"
        >
          <LogOut className="mr-2" size={16} />
          Log Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Desktop Sidebar (Left Panel) */}
      <div className="hidden lg:block lg:w-64 flex-shrink-0 h-full no-print">
        <SidebarContent />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile Header Toolbar */}
        <header className="lg:hidden flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm z-10 no-print">
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <Menu size={20} />
          </button>
          <span className="text-lg font-bold tracking-wider text-sky-500">Sameer Distributors</span>
          <button onClick={toggleDarkMode} className="p-2 rounded-lg text-yellow-500 dark:text-sky-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        {/* Content Box */}
        <main className="flex-1 overflow-y-auto px-6 py-8 relative">
          {children}
        </main>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 flex z-50">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          {/* Menu Drawer */}
          <div className="relative flex flex-col w-64 max-w-xs bg-slate-900 text-white animate-slide-in h-full">
            <div className="absolute top-4 right-4">
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <SidebarContent />
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
