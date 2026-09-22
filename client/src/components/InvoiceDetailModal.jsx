import React, { useState, useEffect } from "react";
import api from "../services/api";
import { Printer, X, AlertTriangle } from "lucide-react";
import { formatCurrency, formatCurrencyNoDecimals } from "../utils/format";

// Helper: extract clean note from JSON string if description was packed
const extractCleanNote = (desc) => {
  if (!desc) return "";
  if (typeof desc === "string" && desc.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(desc);
      if (parsed && typeof parsed === "object" && "itemDiscounts" in parsed) {
        return parsed.note || "";
      }
    } catch {}
  }
  return desc;
};

const InvoiceDetailModal = ({ isOpen, onClose, invoiceId, initialInvoice = null }) => {
  const [invoice, setInvoice] = useState(initialInvoice);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [printFormat, setPrintFormat] = useState("a4"); // "a4" | "thermal"

  useEffect(() => {
    if (!isOpen) {
      setInvoice(null);
      setError(null);
      return;
    }

    if (invoiceId) {
      const fetchInvoiceDetails = async () => {
        try {
          setLoading(true);
          setError(null);
          const res = await api.get(`/api/invoice/${invoiceId}`);
          if (res.data?.type === "success") {
            setInvoice(res.data.data);
          } else {
            setError("Failed to load invoice details.");
          }
        } catch (err) {
          console.error("Error fetching invoice details:", err);
          setError(err.response?.data?.message || "Failed to load invoice receipt.");
        } finally {
          setLoading(false);
        }
      };
      fetchInvoiceDetails();
    } else if (initialInvoice) {
      setInvoice(initialInvoice);
    }
  }, [isOpen, invoiceId, initialInvoice]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalReturns = invoice
    ? (invoice.salesReturns || []).reduce((sum, ret) => sum + Number(ret.totalAmount || 0), 0)
    : 0;

  const calculatedBalanceDue = invoice
    ? Math.max(
        0,
        Number(invoice.total) -
          Number(invoice.transportDiscount || 0) -
          Number(invoice.paidAmount || 0) -
          Number(invoice.creditApplied || 0) -
          totalReturns
      )
    : 0;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto print-modal">
      <div
        className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full p-6 shadow-2xl space-y-6 print:border-none print:shadow-none print:p-0 print:m-0 print:w-full print:max-w-full ${
          printFormat === "thermal" ? "max-w-sm thermal-receipt font-mono" : "max-w-2xl font-sans"
        }`}
      >
        {/* Header Controls (no-print) */}
        <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3 no-print">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 dark:text-white">POS Invoice Sheet</h3>
            {invoice && (
              <span
                className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full border ${
                  invoice.documentStatus === "DRAFT"
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-300"
                    : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-300"
                }`}
              >
                {invoice.documentStatus}
              </span>
            )}
          </div>
          <div className="flex space-x-2 items-center">
            <select
              value={printFormat}
              onChange={(e) => setPrintFormat(e.target.value)}
              className="px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 rounded-lg outline-none"
            >
              <option value="a4">Standard A4</option>
              <option value="thermal">Thermal 80mm</option>
            </select>
            <button
              onClick={handlePrint}
              disabled={loading || !invoice}
              className="inline-flex items-center px-3 py-1.5 text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 rounded-lg border border-sky-200 dark:border-sky-900/40 hover:bg-sky-100 transition-colors disabled:opacity-50"
            >
              <Printer size={12} className="mr-1.5" /> Print
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <div className="w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs">Loading invoice details...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 rounded-xl text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        ) : !invoice ? (
          <p className="text-xs text-slate-400 text-center py-8">No invoice selected.</p>
        ) : (
          <>
            {invoice.documentStatus === "DRAFT" && (
              <div className="no-print p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-xl flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                <span>
                  This is a <strong>DRAFT</strong> invoice. Stock deductions and ledger postings are pending confirmation.
                </span>
              </div>
            )}

            {/* Print Sheet Area */}
            {printFormat === "thermal" ? (
              <div className="thermal-receipt text-slate-900 dark:text-slate-100 space-y-4 print:text-black">
                <div className="text-center">
                  <h1 className="text-base font-extrabold tracking-wider">SAMEER DISTRIBUTORS</h1>
                  <p className="text-[10px] mt-0.5">FMCG Distribution Store</p>
                  <p className="text-[9px]">Phone: 03342320521</p>
                  <hr className="my-2 border-dashed border-slate-300 dark:border-slate-700 print:border-black" />
                  <p className="text-[10px] font-bold">
                    {invoice.documentStatus === "DRAFT" ? "[DRAFT] " : ""}RECEIPT: {invoice.invoiceNo}
                  </p>
                  <p className="text-[9px]">Date: {new Date(invoice.invoiceDate).toLocaleString()}</p>
                </div>

                <div className="text-[10px] space-y-0.5">
                  <p>
                    Customer: <span className="font-bold capitalize">{invoice.customer?.name || "Walk-In counter"}</span>
                  </p>
                  {invoice.salesman && (
                    <p>
                      Salesman: <span className="font-bold capitalize">{invoice.salesman.name}</span>
                    </p>
                  )}
                  {invoice.createdBy && (
                    <p>
                      Operator: <span className="font-bold capitalize">{invoice.createdBy.name}</span>
                    </p>
                  )}
                  <p>
                    Type: <span className="font-bold">{invoice.saleType}</span>
                  </p>
                </div>

                <hr className="border-dashed border-slate-300 dark:border-slate-700 print:border-black" />

                <table className="w-full text-left text-[9px] border-collapse">
                  <thead>
                    <tr className="border-b border-dashed border-slate-300 dark:border-slate-700 print:border-black font-bold">
                      <th className="pb-1">Item Description</th>
                      <th className="pb-1 text-right">Qty</th>
                      <th className="pb-1 text-right">Rate</th>
                      <th className="pb-1 text-right">Amt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items?.map((item) => (
                      <tr key={item.id}>
                        <td className="py-1 capitalize">
                          {item.product?.name}
                          {item.product?.size ? ` (${item.product.size})` : ""}
                        </td>
                        <td className="py-1 text-right">{item.quantity}</td>
                        <td className="py-1 text-right">{formatCurrencyNoDecimals(item.unitPrice)}</td>
                        <td className="py-1 text-right font-bold">{formatCurrencyNoDecimals(item.totalPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* POS Receipt Totals */}
                <div className="border-t border-dashed border-slate-300 dark:border-slate-700 print:border-black pt-1 space-y-0.5 text-[9px]">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>Rs. {formatCurrencyNoDecimals(invoice.subtotal)}</span>
                  </div>
                  {Number(invoice.discount) > 0 && (
                    <div className="flex justify-between text-rose-500">
                      <span>Discount:</span>
                      <span>-Rs. {formatCurrencyNoDecimals(invoice.discount)}</span>
                    </div>
                  )}
                  {Number(invoice.transportDiscount) > 0 ? (
                    <>
                      <div className="flex justify-between font-bold border-t border-dashed border-slate-200 dark:border-slate-800 print:border-slate-300 pt-0.5">
                        <span>Running Total:</span>
                        <span>Rs. {formatCurrencyNoDecimals(invoice.total)}</span>
                      </div>
                      <div className="flex justify-between text-amber-600 dark:text-amber-500">
                        <span>Transport Disc:</span>
                        <span>-Rs. {formatCurrencyNoDecimals(invoice.transportDiscount)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-dashed border-slate-200 dark:border-slate-800 print:border-slate-300 pt-0.5">
                        <span>Net Payable:</span>
                        <span>Rs. {formatCurrencyNoDecimals(Number(invoice.total) - Number(invoice.transportDiscount || 0))}</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex justify-between font-bold border-t border-dashed border-slate-200 dark:border-slate-800 print:border-slate-300 pt-0.5">
                      <span>Grand Total:</span>
                      <span>Rs. {formatCurrencyNoDecimals(invoice.total)}</span>
                    </div>
                  )}
                  {Number(invoice.creditApplied) > 0 && (
                    <div className="flex justify-between">
                      <span>Store Credit:</span>
                      <span>Rs. {formatCurrencyNoDecimals(invoice.creditApplied)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Paid (Cash):</span>
                    <span>Rs. {formatCurrencyNoDecimals(invoice.paidAmount)}</span>
                  </div>
                  {calculatedBalanceDue > 0 && (
                    <div className="flex justify-between text-rose-500 font-bold">
                      <span>Balance Due:</span>
                      <span>Rs. {formatCurrencyNoDecimals(calculatedBalanceDue)}</span>
                    </div>
                  )}
                </div>

                <hr className="border-dashed border-slate-300 dark:border-slate-700 print:border-black" />

                <div className="text-center text-[9px] italic mt-2">
                  <p>Thank you for shopping with us!</p>
                  <p>Powered by Sameer Distributors</p>
                </div>
              </div>
            ) : (
              <div className="print-area text-slate-900 dark:text-slate-100 font-sans" style={{ fontSize: "12px" }}>
                {/* COMPANY HEADER */}
                <div
                  className="border-b-2 border-slate-900 dark:border-slate-200 print:border-black"
                  style={{ textAlign: "center", paddingBottom: "10px", marginBottom: "12px" }}
                >
                  <h1 style={{ fontSize: "20px", fontWeight: "900", margin: "0 0 2px 0", letterSpacing: "0.5px" }}>
                    Sameer Distributors
                  </h1>
                  <p className="text-slate-600 dark:text-slate-300 print:text-slate-800" style={{ fontSize: "11px", margin: "0" }}>
                    Quetta, Pakistan &nbsp;|&nbsp; Contact: 03342320521
                  </p>
                </div>

                {/* INVOICE META */}
                <div style={{ marginBottom: "12px", lineHeight: "1.8" }}>
                  <p style={{ margin: "0" }}>
                    <strong>Invoice No:</strong> {invoice.invoiceNo} {invoice.documentStatus === "DRAFT" ? "(DRAFT)" : ""}
                  </p>
                  <p style={{ margin: "0" }}>
                    <strong>Date:</strong> {new Date(invoice.invoiceDate).toISOString().split("T")[0]}
                  </p>
                  {invoice.salesman && (
                    <p style={{ margin: "0" }}>
                      <strong>Booker:</strong> {invoice.salesman.name.toUpperCase()}
                    </p>
                  )}
                  {invoice.createdBy && (
                    <p style={{ margin: "0" }}>
                      <strong>Operator:</strong> {invoice.createdBy.name.toUpperCase()}
                    </p>
                  )}
                  <p style={{ margin: "0" }}>
                    <strong>Bill To:</strong> {(invoice.customer?.name || "Counter Cash Customer").toUpperCase()}
                  </p>
                  {invoice.customer?.address && (
                    <p style={{ margin: "0" }}>
                      <strong>Address:</strong> {invoice.customer.address.toUpperCase()}
                    </p>
                  )}
                </div>

                {/* ITEMS TABLE */}
                {(() => {
                  const itemsWithDiscountInfo = (invoice.items || []).map((item) => {
                    const tpRate = Number(item.unitPrice);
                    const lineTotal = tpRate * item.quantity;
                    const discAmt = Math.max(0, lineTotal - Number(item.totalPrice));
                    const netRate = item.quantity > 0 ? Number(item.totalPrice) / item.quantity : tpRate;

                    let isPercentDiscount = false;
                    let discPctDisplay = "";

                    if (item.discountType === "%" && Number(item.discountValue) > 0) {
                      isPercentDiscount = true;
                      discPctDisplay = `${Number(item.discountValue)}%`;
                    } else if (item.discountType && item.discountType !== "%") {
                      isPercentDiscount = false;
                    } else if (discAmt > 0 && lineTotal > 0) {
                      const rawPct = (discAmt / lineTotal) * 100;
                      const roundedPct = Math.round(rawPct);
                      const isCleanIntegerPct = Math.abs(rawPct - roundedPct) < 0.001;
                      const calculatedAmtFromPct = Math.round(((lineTotal * roundedPct) / 100) * 100) / 100;
                      if (isCleanIntegerPct && Math.abs(calculatedAmtFromPct - discAmt) < 0.01) {
                        isPercentDiscount = true;
                        discPctDisplay = `${roundedPct}%`;
                      }
                    }

                    return {
                      ...item,
                      tpRate,
                      lineTotal,
                      discAmt,
                      netRate,
                      isPercentDiscount,
                      discPctDisplay,
                    };
                  });

                  const hasPercentDiscount = itemsWithDiscountInfo.some((it) => it.isPercentDiscount);

                  return (
                    <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "12px", fontSize: "11px" }}>
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 border-t border-b border-slate-900 dark:border-slate-200 print:border-black">
                          <th style={{ padding: "5px 6px", textAlign: "left", fontWeight: "700" }} className="border-r border-slate-300 dark:border-slate-700 print:border-slate-300">
                            #
                          </th>
                          <th style={{ padding: "5px 6px", textAlign: "left", fontWeight: "700" }} className="border-r border-slate-300 dark:border-slate-700 print:border-slate-300">
                            Item
                          </th>
                          <th style={{ padding: "5px 6px", textAlign: "right", fontWeight: "700" }} className="border-r border-slate-300 dark:border-slate-700 print:border-slate-300">
                            TP Rate
                          </th>
                          {hasPercentDiscount && (
                            <th style={{ padding: "5px 6px", textAlign: "right", fontWeight: "700" }} className="border-r border-slate-300 dark:border-slate-700 print:border-slate-300">
                              Disc %
                            </th>
                          )}
                          <th style={{ padding: "5px 6px", textAlign: "right", fontWeight: "700" }} className="border-r border-slate-300 dark:border-slate-700 print:border-slate-300">
                            Disc Amt
                          </th>
                          <th style={{ padding: "5px 6px", textAlign: "right", fontWeight: "700" }} className="border-r border-slate-300 dark:border-slate-700 print:border-slate-300">
                            Net Rate
                          </th>
                          <th style={{ padding: "5px 6px", textAlign: "right", fontWeight: "700" }} className="border-r border-slate-300 dark:border-slate-700 print:border-slate-300">
                            Qty
                          </th>
                          <th style={{ padding: "5px 6px", textAlign: "right", fontWeight: "700" }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsWithDiscountInfo.map((item, idx) => (
                          <tr key={item.id || idx} className="border-b border-slate-200 dark:border-slate-800 print:border-slate-200">
                            <td style={{ padding: "5px 6px", fontWeight: "600" }} className="border-r border-slate-200 dark:border-slate-800 print:border-slate-200">
                              {String(idx + 1).padStart(3, "0")}
                            </td>
                            <td style={{ padding: "5px 6px", textTransform: "uppercase", fontWeight: "500" }} className="border-r border-slate-200 dark:border-slate-800 print:border-slate-200">
                              {item.product?.name}
                              {item.product?.size ? ` (${item.product.size})` : ""}
                            </td>
                            <td style={{ padding: "5px 6px", textAlign: "right" }} className="border-r border-slate-200 dark:border-slate-800 print:border-slate-200">
                              {formatCurrency(item.tpRate)}
                            </td>
                            {hasPercentDiscount && (
                              <td style={{ padding: "5px 6px", textAlign: "right" }} className="border-r border-slate-200 dark:border-slate-800 print:border-slate-200">
                                {item.isPercentDiscount ? item.discPctDisplay : "-"}
                              </td>
                            )}
                            <td style={{ padding: "5px 6px", textAlign: "right" }} className="border-r border-slate-200 dark:border-slate-800 print:border-slate-200">
                              {formatCurrency(item.discAmt)}
                            </td>
                            <td style={{ padding: "5px 6px", textAlign: "right" }} className="border-r border-slate-200 dark:border-slate-800 print:border-slate-200">
                              {formatCurrency(item.netRate)}
                            </td>
                            <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: "600" }} className="border-r border-slate-200 dark:border-slate-800 print:border-slate-200">
                              {item.quantity}
                            </td>
                            <td style={{ padding: "5px 6px", textAlign: "right", fontWeight: "700" }}>{formatCurrency(item.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}

                {/* SUMMARY SECTION */}
                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "4px" }}>
                  <div style={{ minWidth: "300px", fontSize: "12px" }}>
                    <div className="border-t border-slate-300 dark:border-slate-700 print:border-slate-300" style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                      <span>Items Subtotal:</span>
                      <span style={{ fontWeight: "700" }}>PKR {formatCurrency(Number(invoice.subtotal))}</span>
                    </div>
                    {Number(invoice.discount) > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                        <span>Invoice Discount:</span>
                        <span style={{ fontWeight: "600" }}>PKR {formatCurrency(Number(invoice.discount || 0))}</span>
                      </div>
                    )}
                    {Number(invoice.transportDiscount) > 0 ? (
                      <>
                        <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0" }}>
                          <span>Running Total:</span>
                          <span style={{ fontWeight: "600" }}>PKR {formatCurrency(Number(invoice.total))}</span>
                        </div>
                        {(() => {
                          const transPct =
                            Number(invoice.total) > 0
                              ? ((Number(invoice.transportDiscount) / Number(invoice.total)) * 100).toFixed(1)
                              : null;
                          return (
                            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", color: "#d97706" }}>
                              <span>Transport Disc{transPct ? ` (${transPct}%)` : ""}:</span>
                              <span style={{ fontWeight: "600" }}>PKR {formatCurrency(Number(invoice.transportDiscount || 0))}</span>
                            </div>
                          );
                        })()}
                        <div className="border-t-2 border-slate-900 dark:border-slate-200 print:border-black" style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", marginTop: "4px" }}>
                          <span style={{ fontWeight: "800", fontSize: "13px" }}>NET PAYABLE AMOUNT:</span>
                          <span style={{ fontWeight: "900", fontSize: "13px" }}>PKR {formatCurrency(Number(invoice.total) - Number(invoice.transportDiscount || 0))}</span>
                        </div>
                      </>
                    ) : (
                      <div className="border-t-2 border-slate-900 dark:border-slate-200 print:border-black" style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", marginTop: "4px" }}>
                        <span style={{ fontWeight: "800", fontSize: "13px" }}>NET TOTAL AMOUNT:</span>
                        <span style={{ fontWeight: "900", fontSize: "13px" }}>PKR {formatCurrency(Number(invoice.total))}</span>
                      </div>
                    )}
                    {Number(invoice.creditApplied) > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#3b82f6" }}>
                        <span>Store Credit Applied:</span>
                        <span style={{ fontWeight: "600" }}>- PKR {formatCurrency(invoice.creditApplied)}</span>
                      </div>
                    )}
                    {totalReturns > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#f43f5e" }}>
                        <span>Returned Value:</span>
                        <span style={{ fontWeight: "600" }}>- PKR {formatCurrency(totalReturns)}</span>
                      </div>
                    )}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#16a34a" }}>
                      <span>Amount Received (Cash):</span>
                      <span style={{ fontWeight: "600" }}>PKR {formatCurrency(invoice.paidAmount)}</span>
                    </div>
                    {calculatedBalanceDue > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", color: "#dc2626", fontWeight: "700" }}>
                        <span>Balance Due:</span>
                        <span>PKR {formatCurrency(calculatedBalanceDue)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* ASSOCIATED RETURNS */}
                {invoice.salesReturns && invoice.salesReturns.length > 0 && (
                  <div className="border-t border-slate-200 dark:border-slate-800 print:border-slate-250" style={{ marginTop: "12px", paddingTop: "8px", fontSize: "11px" }}>
                    <span className="font-bold text-rose-600 dark:text-rose-450 block mb-1">Associated Returns:</span>
                    <div style={{ paddingLeft: "4px" }} className="space-y-1 text-slate-600 dark:text-slate-400 font-mono text-[10px]">
                      {invoice.salesReturns.map((ret) => (
                        <div key={ret.id} style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>{ret.returnNo}</span>
                          <span className="font-bold">Rs. {formatCurrency(ret.totalAmount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FOOTER NOTES */}
                {extractCleanNote(invoice.description) ? (
                  <div className="border-t border-slate-200 dark:border-slate-800 print:border-slate-200 text-slate-500 dark:text-slate-400" style={{ marginTop: "12px", paddingTop: "6px", fontSize: "11px", fontStyle: "italic" }}>
                    Notes: {extractCleanNote(invoice.description)}
                  </div>
                ) : null}

                <div className="border-t border-dashed border-slate-300 dark:border-slate-700 print:border-slate-300 text-slate-400" style={{ textAlign: "center", marginTop: "16px", fontSize: "10px", paddingTop: "8px" }}>
                  Thank you for your business! | Sameer Distributors | 03342320521
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default InvoiceDetailModal;
