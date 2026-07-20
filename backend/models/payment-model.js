const prisma = require("../config/prisma");
const ledgerModel = require("./ledger-model");

/**
 * Records a customer payment atomically.
 * Validates outstanding invoice/general balances to prevent overpayments, and posts a credit to the ledger.
 */
async function recordCustomerPayment({ customerId, invoiceId, allocations = [], amount, isCreditApplied = false, paymentDate, description, createdById }) {
  return prisma.$transaction(async (tx) => {
    // 1. Verify customer exists and lock the row to serialize customer payment transactions
    const customers = await tx.$queryRaw`
      SELECT * FROM "Customer" 
      WHERE id = ${customerId} 
      FOR UPDATE
    `;
    const customer = customers[0];
    if (!customer) {
      const error = new Error("Customer not found.");
      error.statusCode = 404;
      throw error;
    }

    // Normalize invoiceId to allocations list for backward compatibility
    let finalAllocations = [];
    if (allocations && allocations.length > 0) {
      finalAllocations = allocations;
    } else if (invoiceId) {
      finalAllocations = [{ invoiceId, amountAllocated: amount }];
    }

    // 2. Validate payment limit constraints based on invoice vs general payment
    if (isCreditApplied) {
      if (finalAllocations.length === 0) {
        const error = new Error("Allocations are required when applying credit.");
        error.statusCode = 400;
        throw error;
      }

      // Calculate available store credit dynamically from the customer's negative balance
      const customerBalance = Number(customer.balance);
      const availableCredit = customerBalance < 0 ? Math.abs(customerBalance) : 0;

      if (amount > availableCredit) {
        const error = new Error(
          `Applied credit (${amount}) cannot exceed customer's available credit (${availableCredit}).`
        );
        error.statusCode = 400;
        throw error;
      }
    } else {
      const customerBalance = Number(customer.balance);
      if (customerBalance <= 0) {
        const error = new Error("No payment allowed if customer does not owe anything.");
        error.statusCode = 400;
        throw error;
      }
      if (amount > customerBalance) {
        const error = new Error(
          `Payment amount (${amount}) cannot exceed customer overall outstanding balance (${customerBalance}).`
        );
        error.statusCode = 400;
        throw error;
      }
    }

    // Validate that total allocations do not exceed the payment amount
    const sumAllocated = finalAllocations.reduce((sum, alloc) => sum + Number(alloc.amountAllocated || alloc.amount || 0), 0);
    if (sumAllocated > amount) {
      const error = new Error(`Total allocated amount (${sumAllocated}) cannot exceed the payment amount (${amount}).`);
      error.statusCode = 400;
      throw error;
    }

    // Validate that each allocation amount is positive
    for (const alloc of finalAllocations) {
      const allocAmt = Number(alloc.amountAllocated || alloc.amount || 0);
      if (allocAmt <= 0) {
        const error = new Error("Allocation amount must be positive.");
        error.statusCode = 400;
        throw error;
      }
    }

    // 3. Create the CustomerPayment record (decoupled from invoiceId)
    const payment = await tx.customerPayment.create({
      data: {
        customerId,
        amount,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        description: description || (isCreditApplied ? "Store credit applied" : undefined),
        // Tag the record type so cash-flow reports can exclude non-cash movements.
        paymentType: isCreditApplied ? "CREDIT_APPLICATION" : "CASH",
        createdById,
      },
    });

    // 4. Process allocations and update invoices atomically
    for (const alloc of finalAllocations) {
      const allocAmt = Number(alloc.amountAllocated || alloc.amount || 0);

      // Atomic update with concurrency check
      const updateResult = await tx.invoice.updateMany({
        where: {
          id: alloc.invoiceId,
          customerId,
          balanceDue: { gte: allocAmt }
        },
        data: isCreditApplied ? {
          creditApplied: { increment: allocAmt },
          balanceDue: { decrement: allocAmt }
        } : {
          paidAmount: { increment: allocAmt },
          balanceDue: { decrement: allocAmt }
        }
      });

      if (updateResult.count === 0) {
        const inv = await tx.invoice.findUnique({ where: { id: alloc.invoiceId } });
        if (!inv) {
          throw new Error(`Invoice with ID ${alloc.invoiceId} not found.`);
        }
        if (inv.customerId !== customerId) {
          throw new Error(`Invoice ID ${alloc.invoiceId} does not belong to Customer ID ${customerId}.`);
        }
        throw new Error(`Allocation of Rs. ${allocAmt.toFixed(2)} exceeds outstanding balance (Rs. ${Number(inv.balanceDue).toFixed(2)}) on Invoice #${inv.invoiceNo}.`);
      }

      // Recalculate status and update the invoice
      const updatedInvoice = await tx.invoice.findUnique({ where: { id: alloc.invoiceId } });
      const totalSettled = Number(updatedInvoice.paidAmount) + Number(updatedInvoice.creditApplied || 0) + Number(updatedInvoice.returnedAmount || 0);
      const newStatus = totalSettled >= Number(updatedInvoice.total) ? "PAID" : (totalSettled > 0 ? "PARTIALLY_PAID" : "UNPAID");
      await tx.invoice.update({
        where: { id: alloc.invoiceId },
        data: { status: newStatus }
      });


      // Save the allocation
      await tx.paymentAllocation.create({
        data: {
          customerPaymentId: payment.id,
          invoiceId: alloc.invoiceId,
          amountAllocated: allocAmt,
        }
      });
    }

    // 5. Post entry in CustomerLedger (cash payments only)
    // Credit applications do NOT post a new ledger entry because the original
    // sales return already posted a CREDIT that reduced the customer's balance.
    // isCreditApplied just tags how the invoice's balanceDue was settled;
    // it is a reconciliation label on the invoice, not a new money movement.
    if (!isCreditApplied) {
      await ledgerModel.recordCustomerLedgerEntry(
        {
          customerId,
          debit: 0,
          credit: amount,
          referenceType: "PAYMENT",
          referenceId: payment.id,
          description: description || (finalAllocations.length === 1 ? `Payment for Invoice` : "Customer Payment Allocation"),
        },
        tx
      );
    }

    return payment;
  });

}

/**
 * Refunds a customer's existing store-credit balance as cash.
 *
 * When a customer has a negative Customer.balance (we owe them money from a
 * prior store-credit return) and they want the cash instead, this function:
 *   1. Validates the available credit is sufficient.
 *   2. Posts a CustomerLedger DEBIT entry that cancels the credit obligation.
 *   3. Creates a CustomerPayment record (paymentType = CASH_REFUND) as an audit trail.
 *
 * DEBIT raises Customer.balance toward zero (delta = debit − credit = +amount),
 * correctly cancelling the prior CREDIT entry that created the negative balance.
 */
async function refundCustomerCreditBalance({ customerId, amount, refundDate, description, createdById }) {
  return prisma.$transaction(async (tx) => {
    // 1. Verify customer
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      const error = new Error("Customer not found.");
      error.statusCode = 404;
      throw error;
    }

    // 2. Customer must have a genuine credit balance (negative balance = we owe them)
    const customerBalance = Number(customer.balance);
    if (customerBalance >= 0) {
      const error = new Error(
        `Customer has no credit balance to refund. Current balance: Rs. ${customerBalance.toFixed(2)}.`
      );
      error.statusCode = 400;
      throw error;
    }

    const availableCredit = Math.abs(customerBalance);
    if (amount > availableCredit) {
      const error = new Error(
        `Refund amount (Rs. ${amount}) exceeds available credit balance (Rs. ${availableCredit.toFixed(2)}).`
      );
      error.statusCode = 400;
      throw error;
    }

    if (amount <= 0) {
      const error = new Error("Refund amount must be positive.");
      error.statusCode = 400;
      throw error;
    }

    // 3. Create CustomerPayment record first (paymentType = CASH_REFUND) for audit trail
    const payment = await tx.customerPayment.create({
      data: {
        customerId,
        amount,
        paymentDate: refundDate ? new Date(refundDate) : new Date(),
        description: description || `Cash refund of store credit`,
        paymentType: "CASH_REFUND",
        createdById,
      },
    });

    // 4. Post a DEBIT entry in CustomerLedger.
    //    delta = debit − credit = amount → Customer.balance += amount (rises toward 0)
    //    This cancels the prior CREDIT entry that created the negative balance.
    await ledgerModel.recordCustomerLedgerEntry(
      {
        customerId,
        debit: amount,
        credit: 0,
        referenceType: "PAYMENT",
        referenceId: payment.id,
        description: description || `Cash refund of store credit (Payment ID: ${payment.id})`,
      },
      tx
    );

    return payment;
  });

}

/**
 * Records a supplier payment atomically.
 * Validates outstanding balances to prevent overpayments, and posts a debit to the ledger.
 */
async function recordSupplierPayment({ supplierId, purchaseId, amount, isCreditApplied = false, paymentDate, description, createdById }) {
  return prisma.$transaction(async (tx) => {
    // 1. Verify supplier exists and lock the row to serialize supplier payment transactions
    const suppliers = await tx.$queryRaw`
      SELECT * FROM "Supplier" 
      WHERE id = ${supplierId} 
      FOR UPDATE
    `;
    const supplier = suppliers[0];
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
      // Calculate available credit as the supplier's negative balance (prepayments/returns credit)
      const supplierBalance = Number(supplier.balance);
      const availableCredit = supplierBalance < 0 ? Math.abs(supplierBalance) : 0;

      if (amount > availableCredit) {
        const error = new Error(
          `Applied credit (${amount}) cannot exceed supplier's available credit (${availableCredit}).`
        );
        error.statusCode = 400;
        throw error;
      }
    } else {
      const supplierBalance = Number(supplier.balance);
      if (supplierBalance <= 0) {
        const error = new Error("No payment allowed if supplier does not have an outstanding balance.");
        error.statusCode = 400;
        throw error;
      }
      if (amount > supplierBalance) {
        const error = new Error(
          `Payment amount (${amount}) cannot exceed supplier overall outstanding balance (${supplierBalance}).`
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
        paymentType: purchaseId ? "NORMAL" : "ADVANCE",
        createdById,
      },
    });

    // 5. Update the Purchase payment progress (if targetPurchase provided)
    if (purchaseId && targetPurchase) {
      if (isCreditApplied) {
        const newCreditApplied = Number(targetPurchase.creditApplied || 0) + amount;
        const newPaidAmount = Number(targetPurchase.paidAmount || 0);
        const newBalanceDue = Number(targetPurchase.total) - newPaidAmount - newCreditApplied - Number(targetPurchase.returnedAmount || 0);
        const newStatus = (newPaidAmount + newCreditApplied + Number(targetPurchase.returnedAmount || 0)) >= Number(targetPurchase.total) ? "PAID" : "PARTIALLY_PAID";

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
        const newBalanceDue = Number(targetPurchase.total) - newPaidAmount - Number(targetPurchase.creditApplied || 0) - Number(targetPurchase.returnedAmount || 0);
        const newStatus = (newPaidAmount + Number(targetPurchase.creditApplied || 0) + Number(targetPurchase.returnedAmount || 0)) >= Number(targetPurchase.total) ? "PAID" : "PARTIALLY_PAID";

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


    // 6. Post entry in SupplierLedger (cash payments only)
    // Credit note applications do NOT post a new ledger entry because the original
    // purchase return already posted a CREDIT that reduced the supplier's balance.
    // isCreditApplied just tags how the purchase's balanceDue was settled;
    // it is a reconciliation label on the purchase, not a new money movement.
    if (!isCreditApplied) {
      await ledgerModel.recordSupplierLedgerEntry(
        {
          supplierId,
          debit: amount,
          credit: 0,
          referenceType: "PAYMENT",
          referenceId: payment.id,
          description: description || (purchaseId ? `Payment for Purchase #${targetPurchase.purchaseNo}` : "General Account Payment"),
        },
        tx
      );
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
      allocations: {
        include: {
          invoice: {
            select: {
              invoiceNo: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

/**
 * Allocates an existing general customer payment to one or more invoices.
 * Supports upsert logic: if an allocation already exists for the same invoice,
 * it increments the allocation amount after validating all balance due guards atomically.
 */
async function allocateCustomerPayment({ customerPaymentId, allocations }) {
  return prisma.$transaction(async (tx) => {
    // 1. Lock the customer payment row to prevent concurrent allocation race conditions
    const payments = await tx.$queryRaw`
      SELECT * FROM "CustomerPayment" 
      WHERE id = ${customerPaymentId} 
      FOR UPDATE
    `;
    const payment = payments[0];
    if (!payment) {
      const error = new Error("Customer payment not found.");
      error.statusCode = 404;
      throw error;
    }

    // Fetch existing allocations for this payment (safely locked now)
    const existingAllocations = await tx.paymentAllocation.findMany({
      where: { customerPaymentId },
    });

    const customerId = payment.customerId;

    // Calculate current allocated sum
    const currentAllocatedSum = existingAllocations.reduce((sum, alloc) => sum + Number(alloc.amountAllocated), 0);
    const availableAmount = Number(payment.amount) - currentAllocatedSum;

    // 2. Validate new allocations total capacity
    const newAllocatedSum = allocations.reduce((sum, alloc) => sum + Number(alloc.amountAllocated || alloc.amount || 0), 0);
    if (newAllocatedSum > availableAmount) {
      const error = new Error(`Allocated sum (${newAllocatedSum}) cannot exceed the available payment balance (${availableAmount}).`);
      error.statusCode = 400;
      throw error;
    }

    const results = [];

    // 3. Process allocations atomically
    for (const alloc of allocations) {
      const allocAmt = Number(alloc.amountAllocated || alloc.amount || 0);
      if (allocAmt <= 0) {
        const error = new Error("Allocation amount must be positive.");
        error.statusCode = 400;
        throw error;
      }

      // Check if this payment already has an allocation for this invoice (upsert logic)
      const existingAlloc = existingAllocations.find(a => a.invoiceId === alloc.invoiceId);

      // Perform atomic updateMany to verify balanceDue and apply decrement
      const updateResult = await tx.invoice.updateMany({
        where: {
          id: alloc.invoiceId,
          customerId,
          balanceDue: { gte: allocAmt }
        },
        data: {
          paidAmount: { increment: allocAmt },
          balanceDue: { decrement: allocAmt }
        }
      });

      if (updateResult.count === 0) {
        const inv = await tx.invoice.findUnique({ where: { id: alloc.invoiceId } });
        if (!inv) {
          throw new Error(`Invoice with ID ${alloc.invoiceId} not found.`);
        }
        if (inv.customerId !== customerId) {
          throw new Error(`Invoice ID ${alloc.invoiceId} does not belong to Customer ID ${customerId}.`);
        }
        throw new Error(`Allocation of Rs. ${allocAmt.toFixed(2)} exceeds outstanding balance (Rs. ${Number(inv.balanceDue).toFixed(2)}) on Invoice #${inv.invoiceNo}.`);
      }

      // Recalculate status and update the invoice
      const updatedInvoice = await tx.invoice.findUnique({ where: { id: alloc.invoiceId } });
      const totalSettled = Number(updatedInvoice.paidAmount) + Number(updatedInvoice.creditApplied || 0) + Number(updatedInvoice.returnedAmount || 0);
      const newStatus = totalSettled >= Number(updatedInvoice.total) ? "PAID" : (totalSettled > 0 ? "PARTIALLY_PAID" : "UNPAID");
      await tx.invoice.update({
        where: { id: alloc.invoiceId },
        data: { status: newStatus }
      });


      let allocationRecord;
      if (existingAlloc) {
        // Upsert: increment existing allocation amount
        allocationRecord = await tx.paymentAllocation.update({
          where: { id: existingAlloc.id },
          data: {
            amountAllocated: { increment: allocAmt },
          },
        });
      } else {
        // Create new allocation
        allocationRecord = await tx.paymentAllocation.create({
          data: {
            customerPaymentId,
            invoiceId: alloc.invoiceId,
            amountAllocated: allocAmt,
          },
        });
      }

      results.push(allocationRecord);
    }

    return results;
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
  allocateCustomerPayment,
  refundCustomerCreditBalance,
  recordSupplierPayment,
  getAllCustomerPayments,
  countCustomerPayments,
  getAllSupplierPayments,
  countSupplierPayments,
};
