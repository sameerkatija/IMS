import React, { useEffect } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

export const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-5 right-5 flex items-center p-4 rounded-xl border shadow-xl z-[9999] transition-all duration-300 transform translate-y-0 scale-100 ${
        type === "success"
          ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-300"
          : "bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-300"
      }`}
    >
      {type === "success" ? (
        <CheckCircle2 className="mr-3 text-emerald-500 flex-shrink-0" size={18} />
      ) : (
        <AlertCircle className="mr-3 text-rose-500 flex-shrink-0" size={18} />
      )}
      <span className="text-sm font-medium mr-6">{message}</span>
      <button
        onClick={onClose}
        className="ml-auto p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export default Toast;
