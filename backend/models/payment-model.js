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
      const netPayable = Number(updatedInvoice.total) - Number(updatedInvoice.transportDiscount || 0);
      const newStatus = totalSettled >= netPayable ? "PAID" : (totalSettled > 0 ? "PARTIALLY_PAID" : "UNPAID");
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

    // 5. Post entry in CustomerLedger
    // For cash payments: post a CREDIT that reduces what the customer owes us.
    // For credit applications: post a DEBIT that consumes the stored credit
    // (brings Customer.balance back toward 0 from negative). Without this,
    // Customer.balance would never be updated and the same credit could be
    // applied to multiple invoices indefinitely — an accounting error.
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
    } else {
      // CREDIT APPLICATION: consume the customer's store credit.
      // Debit entry raises Customer.balance toward 0 (cancels the prior CREDIT).
      await ledgerModel.recordCustomerLedgerEntry(
        {
          customerId,
          debit: amount,
          credit: 0,
          referenceType: "PAYMENT",
          referenceId: payment.id,
          description: description || `Store credit applied via payment allocation`,
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
async function recordSupplierPayment({ supplierId, purchaseId, allocations = [], amount, isCreditApplied = false, paymentDate, description, createdById }) {
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

    // Normalize purchaseId to allocations list for backward compatibility
    let finalAllocations = [];
    if (allocations && allocations.length > 0) {
      finalAllocations = allocations;
    } else if (purchaseId) {
      finalAllocations = [{ purchaseId, amountAllocated: amount }];
    }

    // 2. Validate supplier outstanding balance OR available credit
    if (isCreditApplied) {
      if (finalAllocations.length === 0) {
        const error = new Error("Allocations are required when applying credit.");
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

    // Determine purchaseId for the single payment record
    const singlePurchaseId = finalAllocations.length === 1 ? finalAllocations[0].purchaseId : null;
    let targetPurchase = null;
    if (singlePurchaseId) {
      targetPurchase = await tx.purchase.findUnique({ where: { id: singlePurchaseId } });
    }

    // 3. Create the SupplierPayment record
    const payment = await tx.supplierPayment.create({
      data: {
        supplierId,
        purchaseId: singlePurchaseId,
        amount,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        description: description || (isCreditApplied && targetPurchase ? `Credit note applied to Purchase #${targetPurchase.purchaseNo}` : undefined),
        paymentType: singlePurchaseId ? "NORMAL" : "ADVANCE",
        createdById,
      },
    });

    // 4. Process allocations and update purchases atomically
    for (const alloc of finalAllocations) {
      const allocAmt = Number(alloc.amountAllocated || alloc.amount || 0);
      const pid = alloc.purchaseId;

      // Atomic update with concurrency check
      const updateResult = await tx.purchase.updateMany({
        where: {
          id: pid,
          supplierId,
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
        const pur = await tx.purchase.findUnique({ where: { id: pid } });
        if (!pur) {
          throw new Error(`Purchase with ID ${pid} not found.`);
        }
        if (pur.supplierId !== supplierId) {
          throw new Error(`Purchase ID ${pid} does not belong to Supplier ID ${supplierId}.`);
        }
        throw new Error(`Allocation of Rs. ${allocAmt.toFixed(2)} exceeds outstanding balance (Rs. ${Number(pur.balanceDue).toFixed(2)}) on Purchase #${pur.purchaseNo}.`);
      }

      // Recalculate status and update the purchase
      const updatedPurchase = await tx.purchase.findUnique({ where: { id: pid } });
      const totalSettled = Number(updatedPurchase.paidAmount) + Number(updatedPurchase.creditApplied || 0) + Number(updatedPurchase.returnedAmount || 0);
      const newStatus = totalSettled >= Number(updatedPurchase.total) ? "PAID" : (totalSettled > 0 ? "PARTIALLY_PAID" : "UNPAID");
      await tx.purchase.update({
        where: { id: pid },
        data: { status: newStatus }
      });

      // Save the allocation
      await tx.supplierPaymentAllocation.create({
        data: {
          supplierPaymentId: payment.id,
          purchaseId: pid,
          amountAllocated: allocAmt,
        }
      });
    }

    // 5. Post entry in SupplierLedger (cash payments only)
    if (!isCreditApplied) {
      await ledgerModel.recordSupplierLedgerEntry(
        {
          supplierId,
          debit: amount,
          credit: 0,
          referenceType: "PAYMENT",
          referenceId: payment.id,
          description: description || (singlePurchaseId && targetPurchase ? `Payment for Purchase #${targetPurchase.purchaseNo}` : "General Account Payment"),
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
      const netPayable = Number(updatedInvoice.total) - Number(updatedInvoice.transportDiscount || 0);
      const newStatus = totalSettled >= netPayable ? "PAID" : (totalSettled > 0 ? "PARTIALLY_PAID" : "UNPAID");
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
      allocations: {
        include: {
          purchase: {
            select: {
              purchaseNo: true,
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
 * Counts total supplier payments.
 */
function countSupplierPayments(where) {
  return prisma.supplierPayment.count({ where });
}

/**
 * Allocates an existing general supplier payment to one or more purchases.
 * Supports upsert logic: if an allocation already exists for the same purchase,
 * it increments the allocation amount after validating all balance due guards atomically.
 */
async function allocateSupplierPayment({ supplierPaymentId, allocations }) {
  return prisma.$transaction(async (tx) => {
    // 1. Lock the supplier payment row to prevent concurrent allocation race conditions
    const payments = await tx.$queryRaw`
      SELECT * FROM "SupplierPayment" 
      WHERE id = ${supplierPaymentId} 
      FOR UPDATE
    `;
    const payment = payments[0];
    if (!payment) {
      const error = new Error("Supplier payment not found.");
      error.statusCode = 404;
      throw error;
    }

    // Fetch existing allocations for this payment (safely locked now)
    const existingAllocations = await tx.supplierPaymentAllocation.findMany({
      where: { supplierPaymentId },
    });

    const supplierId = payment.supplierId;

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

      // Check if this payment already has an allocation for this purchase (upsert logic)
      const existingAlloc = existingAllocations.find(a => a.purchaseId === alloc.purchaseId);

      // Perform atomic updateMany to verify balanceDue and apply decrement
      const updateResult = await tx.purchase.updateMany({
        where: {
          id: alloc.purchaseId,
          supplierId,
          balanceDue: { gte: allocAmt }
        },
        data: {
          paidAmount: { increment: allocAmt },
          balanceDue: { decrement: allocAmt }
        }
      });

      if (updateResult.count === 0) {
        const pur = await tx.purchase.findUnique({ where: { id: alloc.purchaseId } });
        if (!pur) {
          throw new Error(`Purchase with ID ${alloc.purchaseId} not found.`);
        }
        if (pur.supplierId !== supplierId) {
          throw new Error(`Purchase ID ${alloc.purchaseId} does not belong to Supplier ID ${supplierId}.`);
        }
        throw new Error(`Allocation of Rs. ${allocAmt.toFixed(2)} exceeds outstanding balance (Rs. ${Number(pur.balanceDue).toFixed(2)}) on Purchase #${pur.purchaseNo}.`);
      }

      // Recalculate status and update the purchase
      const updatedPurchase = await tx.purchase.findUnique({ where: { id: alloc.purchaseId } });
      const totalSettled = Number(updatedPurchase.paidAmount) + Number(updatedPurchase.creditApplied || 0) + Number(updatedPurchase.returnedAmount || 0);
      const newStatus = totalSettled >= Number(updatedPurchase.total) ? "PAID" : (totalSettled > 0 ? "PARTIALLY_PAID" : "UNPAID");
      await tx.purchase.update({
        where: { id: alloc.purchaseId },
        data: { status: newStatus }
      });

      let allocationRecord;
      if (existingAlloc) {
        // Upsert: increment existing allocation amount
        allocationRecord = await tx.supplierPaymentAllocation.update({
          where: { id: existingAlloc.id },
          data: {
            amountAllocated: { increment: allocAmt },
          },
        });
      } else {
        // Create new allocation
        allocationRecord = await tx.supplierPaymentAllocation.create({
          data: {
            supplierPaymentId,
            purchaseId: alloc.purchaseId,
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
 * Applies a customer's existing store-credit balance directly to an existing invoice.
 *
 * Unlike recordCustomerPayment (isCreditApplied=true), this function:
 *   - Does NOT create a CustomerPayment record or PaymentAllocation.
 *   - Automatically caps the applied amount at min(availableCredit, invoiceBalanceDue),
 *     so if the credit is larger than the invoice balance it still works without error.
 *   - Posts a CustomerLedger DEBIT entry to consume the credit, keeping Customer.balance
 *     in sync with the ledger (mandatory for data integrity — omitting this would cause drift).
 *   - Updates Invoice.creditApplied, Invoice.balanceDue, and Invoice.status atomically.
 *
 * @param {number} customerId
 * @param {number} invoiceId
 * @param {number|null} amount - How much credit to apply. If null/omitted, applies as much
 *                               as possible (up to min(availableCredit, balanceDue)).
 */
async function applyStoreCreditToInvoice({ customerId, invoiceId, amount, createdById }) {
  return prisma.$transaction(async (tx) => {
    // 1. Lock customer row to serialize concurrent credit applications
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

    // 2. Check available credit (negative balance = we owe them)
    const customerBalance = Number(customer.balance);
    const availableCredit = customerBalance < 0 ? Math.abs(customerBalance) : 0;
    if (availableCredit <= 0) {
      const error = new Error("Customer has no available store credit to apply.");
      error.statusCode = 400;
      throw error;
    }

    if (amount !== null && amount !== undefined && amount <= 0) {
      const error = new Error("Amount must be a positive number.");
      error.statusCode = 400;
      throw error;
    }

    // 3. Validate invoice
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) {
      const error = new Error("Invoice not found.");
      error.statusCode = 404;
      throw error;
    }
    if (invoice.customerId !== customerId) {
      const error = new Error("Invoice does not belong to this customer.");
      error.statusCode = 400;
      throw error;
    }

    const invoiceBalanceDue = Number(invoice.balanceDue);
    if (invoiceBalanceDue <= 0) {
      const error = new Error(`Invoice ${invoice.invoiceNo} has no outstanding balance to apply credit against.`);
      error.statusCode = 400;
      throw error;
    }

    // 4. Determine how much to actually apply — capped automatically at the smaller of the two
    const requestedAmount = (amount !== null && amount !== undefined) ? Number(amount) : availableCredit;
    const applyAmount = Math.min(requestedAmount, availableCredit, invoiceBalanceDue);
    const roundedAmount = Math.round(applyAmount * 100) / 100;

    if (roundedAmount <= 0) {
      const error = new Error("Computed apply amount is zero. Nothing to apply.");
      error.statusCode = 400;
      throw error;
    }

    // 5. Update invoice fields atomically
    const newCreditApplied = Number(invoice.creditApplied || 0) + roundedAmount;
    const newBalanceDue = Math.max(0, Math.round((invoiceBalanceDue - roundedAmount) * 100) / 100);
    const totalSettled =
      Number(invoice.paidAmount || 0) +
      newCreditApplied +
      Number(invoice.returnedAmount || 0);
    const invoiceTotal = Number(invoice.total);
    const transportDiscount = Number(invoice.transportDiscount || 0);
    const newStatus =
      totalSettled + transportDiscount >= invoiceTotal
        ? "PAID"
        : totalSettled > 0
        ? "PARTIALLY_PAID"
        : "UNPAID";

    await tx.invoice.update({
      where: { id: invoiceId },
      data: {
        creditApplied: newCreditApplied,
        balanceDue: newBalanceDue,
        status: newStatus,
      },
    });

    // 6. Post a DEBIT entry to the CustomerLedger to consume the credit.
    //    This is NOT a new charge — it is the settlement of a prior CREDIT obligation.
    //    Without this, Customer.balance would stay negative forever even after the
    //    credit has been used, and the ledger sum would diverge from the stored balance.
    await ledgerModel.recordCustomerLedgerEntry(
      {
        customerId,
        debit: roundedAmount,
        credit: 0,
        referenceType: "INVOICE",
        referenceId: invoiceId,
        description: `Store credit applied to Invoice ${invoice.invoiceNo}`,
      },
      tx
    );

    return {
      invoiceId,
      invoiceNo: invoice.invoiceNo,
      appliedAmount: roundedAmount,
      newCreditApplied,
      newBalanceDue,
      newStatus,
      remainingCredit: Math.round((availableCredit - roundedAmount) * 100) / 100,
    };
  });
}

/**
 * Applies a supplier's existing credit balance (from over-payments / purchase returns)
 * directly to an existing purchase's balanceDue.
 *
 * Mirrors the behaviour of applyStoreCreditToInvoice but for the supplier side.
 * Caps amount at min(availableCredit, purchaseBalanceDue) automatically.
 */
async function applyStoreCreditToPurchase({ supplierId, purchaseId, amount, createdById }) {
  return prisma.$transaction(async (tx) => {
    // 1. Lock supplier row
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

    const supplierBalance = Number(supplier.balance);
    const availableCredit = supplierBalance < 0 ? Math.abs(supplierBalance) : 0;
    if (availableCredit <= 0) {
      const error = new Error("Supplier has no available credit to apply.");
      error.statusCode = 400;
      throw error;
    }

    if (amount !== null && amount !== undefined && amount <= 0) {
      const error = new Error("Amount must be a positive number.");
      error.statusCode = 400;
      throw error;
    }

    // 2. Validate purchase
    const purchase = await tx.purchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) {
      const error = new Error("Purchase not found.");
      error.statusCode = 404;
      throw error;
    }
    if (purchase.supplierId !== supplierId) {
      const error = new Error("Purchase does not belong to this supplier.");
      error.statusCode = 400;
      throw error;
    }

    const purchaseBalanceDue = Number(purchase.balanceDue);
    if (purchaseBalanceDue <= 0) {
      const error = new Error(`Purchase ${purchase.purchaseNo} has no outstanding balance to apply credit against.`);
      error.statusCode = 400;
      throw error;
    }

    // 3. Cap the applied amount
    const requestedAmount = (amount !== null && amount !== undefined) ? Number(amount) : availableCredit;
    const applyAmount = Math.min(requestedAmount, availableCredit, purchaseBalanceDue);
    const roundedAmount = Math.round(applyAmount * 100) / 100;

    if (roundedAmount <= 0) {
      const error = new Error("Computed apply amount is zero. Nothing to apply.");
      error.statusCode = 400;
      throw error;
    }

    // 4. Update purchase fields atomically
    const newCreditApplied = Number(purchase.creditApplied || 0) + roundedAmount;
    const newBalanceDue = Math.max(0, Math.round((purchaseBalanceDue - roundedAmount) * 100) / 100);
    const totalSettled =
      Number(purchase.paidAmount || 0) +
      newCreditApplied +
      Number(purchase.returnedAmount || 0);
    const purchaseTotal = Number(purchase.total);
    const newStatus =
      totalSettled >= purchaseTotal
        ? "PAID"
        : totalSettled > 0
        ? "PARTIALLY_PAID"
        : "UNPAID";

    await tx.purchase.update({
      where: { id: purchaseId },
      data: {
        creditApplied: newCreditApplied,
        balanceDue: newBalanceDue,
        status: newStatus,
      },
    });

    // 5. Post a CREDIT entry to the SupplierLedger to consume the credit.
    //    SupplierLedger uses credit=increases debt / debit=decreases debt convention.
    //    Consuming the supplier's credit (negative balance) requires a CREDIT entry
    //    that brings the running balance back toward 0.
    //    Wait — for suppliers, negative balance means WE have credit (we overpaid or returned more).
    //    Consuming this credit against a purchase reduces what we owe, which is a DEBIT in supplier ledger.
    //    But the credit was already registered as a DEBIT (purchase return / over-payment debit).
    //    Applying that credit to a purchase effectively CREDITS the supplier ledger (re-adds obligation).
    //    Net: supplier.balance goes from negative toward 0 (delta = credit - debit = roundedAmount - 0 = +roundedAmount).
    //    Since the formula in recordSupplierLedgerEntry is delta = credit - debit, we pass credit=roundedAmount.
    await ledgerModel.recordSupplierLedgerEntry(
      {
        supplierId,
        debit: 0,
        credit: roundedAmount,
        referenceType: "PURCHASE",
        referenceId: purchaseId,
        description: `Supplier credit applied to Purchase ${purchase.purchaseNo}`,
      },
      tx
    );

    return {
      purchaseId,
      purchaseNo: purchase.purchaseNo,
      appliedAmount: roundedAmount,
      newCreditApplied,
      newBalanceDue,
      newStatus,
      remainingCredit: Math.round((availableCredit - roundedAmount) * 100) / 100,
    };
  });
}

module.exports = {
  recordCustomerPayment,
  allocateCustomerPayment,
  refundCustomerCreditBalance,
  applyStoreCreditToInvoice,
  recordSupplierPayment,
  allocateSupplierPayment,
  applyStoreCreditToPurchase,
  getAllCustomerPayments,
  countCustomerPayments,
  getAllSupplierPayments,
  countSupplierPayments,
};
