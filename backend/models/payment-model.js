const prisma = require("../config/prisma");
const ledgerModel = require("./ledger-model");

/**
 * Records a customer payment atomically.
 * Validates outstanding invoice/general balances to prevent overpayments, and posts a credit to the ledger.
 */
async function recordCustomerPayment({ customerId, invoiceId, amount, isCreditApplied = false, paymentDate, description, createdById }) {
  return prisma.$transaction(async (tx) => {
    // 1. Verify customer exists
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      const error = new Error("Customer not found.");
      error.statusCode = 404;
      throw error;
    }

    // 2. Validate payment limit constraints based on invoice vs general payment
    let targetInvoice = null;
    if (isCreditApplied) {
      if (!invoiceId) {
        const error = new Error("Invoice ID is required when applying credit.");
        error.statusCode = 400;
        throw error;
      }

      // Calculate available store credit dynamically
      const outstandingInvoices = await tx.invoice.findMany({
        where: {
          customerId,
          status: { in: ["UNPAID", "PARTIALLY_PAID"] }
        }
      });
      const totalInvoiceOutstanding = outstandingInvoices.reduce((sum, inv) => sum + Number(inv.balanceDue), 0);
      const customerBalance = Number(customer.balance);
      const availableCredit = Math.max(0, totalInvoiceOutstanding - customerBalance);

      if (amount > availableCredit) {
        const error = new Error(
          `Applied credit (${amount}) cannot exceed customer's available credit (${availableCredit}).`
        );
        error.statusCode = 400;
        throw error;
      }
    } else {
      if (!invoiceId) {
        // General account payment
        if (amount > Number(customer.balance)) {
          const error = new Error(
            `Payment amount (${amount}) cannot exceed customer overall outstanding balance (${customer.balance}).`
          );
          error.statusCode = 400;
          throw error;
        }
      }
    }

    if (invoiceId) {
      targetInvoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!targetInvoice) {
        const error = new Error("Invoice not found.");
        error.statusCode = 404;
        throw error;
      }
      if (targetInvoice.customerId !== customerId) {
        const error = new Error("Invoice does not belong to this customer.");
        error.statusCode = 400;
        throw error;
      }
      if (amount > Number(targetInvoice.balanceDue)) {
        const error = new Error(
          `Payment amount (${amount}) cannot exceed outstanding invoice balance due (${targetInvoice.balanceDue}).`
        );
        error.statusCode = 400;
        throw error;
      }
    }

    // 3. Create the CustomerPayment record
    const payment = await tx.customerPayment.create({
      data: {
        customerId,
        invoiceId,
        amount,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        description: description || (isCreditApplied ? `Store credit applied to Invoice #${targetInvoice.invoiceNo}` : undefined),
        createdById,
      },
    });

    // 4. Update the Invoice payment progress (if targetInvoice provided)
    if (invoiceId && targetInvoice) {
      if (isCreditApplied) {
        const newCreditApplied = Number(targetInvoice.creditApplied || 0) + amount;
        const newPaidAmount = Number(targetInvoice.paidAmount || 0);
        const newBalanceDue = Number(targetInvoice.total) - newPaidAmount - newCreditApplied;
        const newStatus = (newPaidAmount + newCreditApplied) >= Number(targetInvoice.total) ? "PAID" : "PARTIALLY_PAID";

        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            creditApplied: newCreditApplied,
            balanceDue: newBalanceDue,
            status: newStatus,
          },
        });
      } else {
        const newPaidAmount = Number(targetInvoice.paidAmount || 0) + amount;
        const newBalanceDue = Number(targetInvoice.total) - newPaidAmount - Number(targetInvoice.creditApplied || 0);
        const newStatus = (newPaidAmount + Number(targetInvoice.creditApplied || 0)) >= Number(targetInvoice.total) ? "PAID" : "PARTIALLY_PAID";

        await tx.invoice.update({
          where: { id: invoiceId },
          data: {
            paidAmount: newPaidAmount,
            balanceDue: newBalanceDue,
            status: newStatus,
          },
        });
      }
    }

    // 5. Post credit entry in CustomerLedger - only if it is NOT a credit application
    if (!isCreditApplied) {
      await ledgerModel.recordCustomerLedgerEntry(
        {
          customerId,
          debit: 0,
          credit: amount,
          referenceType: "INVOICE",
          referenceId: invoiceId || payment.id,
          description: description || (invoiceId ? `Payment for Invoice #${targetInvoice.invoiceNo}` : "General Account Payment"),
        },
        tx
      );
    }

    return payment;
  });
}

/**
 * Records a supplier payment atomically.
 * Validates outstanding balances to prevent overpayments, and posts a debit to the ledger.
 */
async function recordSupplierPayment({ supplierId, purchaseId, amount, isCreditApplied = false, paymentDate, description, createdById }) {
  return prisma.$transaction(async (tx) => {
    // 1. Verify supplier exists
    const supplier = await tx.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      const error = new Error("Supplier not found.");
      error.statusCode = 404;
      throw error;
    }

    // 2. Validate supplier outstanding balance OR available credit
    if (isCreditApplied) {
      if (!purchaseId) {
        const error = new Error("Purchase ID is required when applying credit.");
        error.statusCode = 400;
        throw error;
      }
      // Calculate available credit as the difference between sum of all unpaid purchase balances and the supplier's running balance
      const outstandingPurchases = await tx.purchase.findMany({
        where: {
          supplierId,
          status: { in: ["UNPAID", "PARTIALLY_PAID"] }
        }
      });
      const totalInvoiceOutstanding = outstandingPurchases.reduce((sum, p) => sum + Number(p.balanceDue), 0);
      const supplierBalance = Number(supplier.balance);
      const availableCredit = Math.max(0, totalInvoiceOutstanding - supplierBalance);

      if (amount > availableCredit) {
        const error = new Error(
          `Applied credit (${amount}) cannot exceed supplier's available credit (${availableCredit}).`
        );
        error.statusCode = 400;
        throw error;
      }
    } else {
      if (amount > Number(supplier.balance)) {
        const error = new Error(
          `Payment amount (${amount}) cannot exceed supplier overall outstanding balance (${supplier.balance}).`
        );
        error.statusCode = 400;
        throw error;
      }
    }

    // 3. Verify purchase exists (if purchaseId provided)
    let targetPurchase = null;
    if (purchaseId) {
      targetPurchase = await tx.purchase.findUnique({ where: { id: purchaseId } });
      if (!targetPurchase) {
        const error = new Error("Purchase not found.");
        error.statusCode = 404;
        throw error;
      }
      if (targetPurchase.supplierId !== supplierId) {
        const error = new Error("Purchase does not belong to this supplier.");
        error.statusCode = 400;
        throw error;
      }
      if (amount > Number(targetPurchase.balanceDue)) {
        const error = new Error(
          `Payment amount (${amount}) cannot exceed outstanding purchase balance due (${targetPurchase.balanceDue}).`
        );
        error.statusCode = 400;
        throw error;
      }
    }

    // 4. Create the SupplierPayment record
    const payment = await tx.supplierPayment.create({
      data: {
        supplierId,
        purchaseId,
        amount,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        description: description || (isCreditApplied ? `Credit note applied to Purchase #${targetPurchase.purchaseNo}` : undefined),
        createdById,
      },
    });

    // 5. Update the Purchase payment progress (if targetPurchase provided)
    if (purchaseId && targetPurchase) {
      if (isCreditApplied) {
        const newCreditApplied = Number(targetPurchase.creditApplied || 0) + amount;
        const newPaidAmount = Number(targetPurchase.paidAmount || 0);
        const newBalanceDue = Number(targetPurchase.total) - newPaidAmount - newCreditApplied;
        const newStatus = (newPaidAmount + newCreditApplied) >= Number(targetPurchase.total) ? "PAID" : "PARTIALLY_PAID";

        await tx.purchase.update({
          where: { id: purchaseId },
          data: {
            creditApplied: newCreditApplied,
            balanceDue: newBalanceDue,
            status: newStatus,
          },
        });
      } else {
        const newPaidAmount = Number(targetPurchase.paidAmount || 0) + amount;
        const newBalanceDue = Number(targetPurchase.total) - newPaidAmount - Number(targetPurchase.creditApplied || 0);
        const newStatus = (newPaidAmount + Number(targetPurchase.creditApplied || 0)) >= Number(targetPurchase.total) ? "PAID" : "PARTIALLY_PAID";

        await tx.purchase.update({
          where: { id: purchaseId },
          data: {
            paidAmount: newPaidAmount,
            balanceDue: newBalanceDue,
            status: newStatus,
          },
        });
      }
    }

    // 6. Post debit entry in SupplierLedger (reduces outstanding amount we owe them) - only if it is NOT a credit application
    if (!isCreditApplied) {
      await ledgerModel.recordSupplierLedgerEntry(
        {
          supplierId,
          debit: amount,
          credit: 0,
          referenceType: "PURCHASE", // mapped to PURCHASE to satisfy Prisma enum
          referenceId: purchaseId || payment.id,
          description: description || (purchaseId ? `Payment for Purchase #${targetPurchase.purchaseNo}` : "General Account Payment"),
        },
        tx
      );
    } else {
      // For credit applications, we update the supplier's balance directly by writing a debit entry to the ledger.
      // Wait, is this correct? Let's check:
      // Ah! Earlier we calculated that writing a debit entry would double-count the return credit.
      // So we do NOT write any ledger entry here. We just log the SupplierPayment.
    }

    return payment;
  });
}

/**
 * Returns customer payments list matching filters, ordered by creation desc.
 */
function getAllCustomerPayments({ where, skip, take }) {
  return prisma.customerPayment.findMany({
    where,
    skip,
    take,
    include: {
      customer: {
        select: {
          name: true,
        },
      },
      invoice: {
        select: {
          invoiceNo: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Counts total customer payments.
 */
function countCustomerPayments(where) {
  return prisma.customerPayment.count({ where });
}

/**
 * Returns supplier payments list matching filters, ordered by creation desc.
 */
function getAllSupplierPayments({ where, skip, take }) {
  return prisma.supplierPayment.findMany({
    where,
    skip,
    take,
    include: {
      supplier: {
        select: {
          name: true,
        },
      },
      purchase: {
        select: {
          purchaseNo: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Counts total supplier payments.
 */
function countSupplierPayments(where) {
  return prisma.supplierPayment.count({ where });
}

module.exports = {
  recordCustomerPayment,
  recordSupplierPayment,
  getAllCustomerPayments,
  countCustomerPayments,
  getAllSupplierPayments,
  countSupplierPayments,
};
