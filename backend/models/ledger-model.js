const prisma = require("../config/prisma");

/**
 * Records an entry in the Supplier Ledger and updates the supplier's running balance atomically.
 * Must be executed within a transaction client 'tx'.
 */
async function recordSupplierLedgerEntry({ supplierId, debit = 0, credit = 0, referenceType, referenceId, description }, txClient) {
  const tx = txClient || prisma;
  const delta = credit - debit;

  // Atomically update supplier balance and fetch the updated row
  const supplier = await tx.supplier.update({
    where: { id: supplierId },
    data: {
      balance: {
        increment: delta,
      },
    },
  });

  // Create SupplierLedger log with the new snapshot balance
  const entry = await tx.supplierLedger.create({
    data: {
      supplierId,
      debit,
      credit,
      balance: supplier.balance,
      referenceType,
      referenceId,
      notes: description, // Database column is named notes
    },
  });

  return entry;
}

/**
 * Records an entry in the Customer Ledger and updates the customer's running balance atomically.
 * Must be executed within a transaction client 'tx'.
 */
async function recordCustomerLedgerEntry({ customerId, debit = 0, credit = 0, referenceType, referenceId, description }, txClient) {
  const tx = txClient || prisma;
  const delta = debit - credit;

  // Atomically update customer balance and fetch the updated row
  const customer = await tx.customer.update({
    where: { id: customerId },
    data: {
      balance: {
        increment: delta,
      },
    },
  });

  // Create CustomerLedger log with the new snapshot balance
  const entry = await tx.customerLedger.create({
    data: {
      customerId,
      debit,
      credit,
      balance: customer.balance,
      referenceType,
      referenceId,
      description,
    },
  });

  return entry;
}

/**
 * Reconciles the Customer Ledger running balance, denormalized balance, duplicates, and broken references.
 */
async function reconcileCustomerLedger(customerId) {
  const customer = await prisma.customer.findUnique({
    where: { id: Number(customerId) },
  });
  if (!customer) {
    throw new Error("Customer not found.");
  }

  const entries = await prisma.customerLedger.findMany({
    where: { customerId: Number(customerId) },
    orderBy: { createdAt: "asc" },
  });

  let calculatedSum = 0;
  let runningBalanceMismatch = false;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    calculatedSum += Number(entry.debit) - Number(entry.credit);
    if (Math.abs(calculatedSum - Number(entry.balance)) > 0.01) {
      runningBalanceMismatch = true;
    }
  }

  const denormalizedBalance = Number(customer.balance);
  const drift = Math.abs(denormalizedBalance - calculatedSum);
  const inSync = drift < 0.01 && !runningBalanceMismatch;

  let exactDuplicates = 0;
  const entryKeys = new Set();
  for (const entry of entries) {
    const key = `${entry.referenceType}-${entry.referenceId}-${entry.debit}-${entry.credit}-${entry.description}`;
    if (entryKeys.has(key)) {
      exactDuplicates++;
    } else {
      entryKeys.add(key);
    }
  }

  const invalidReferences = [];
  for (const entry of entries) {
    let exists = true;
    const refId = Number(entry.referenceId);

    if (entry.referenceType === "INVOICE") {
      const record = await prisma.invoice.findUnique({ where: { id: refId } });
      if (!record) {
        const payRecord = await prisma.customerPayment.findUnique({ where: { id: refId } });
        if (!payRecord) exists = false;
      }
    } else if (entry.referenceType === "SALES_RETURN") {
      const record = await prisma.salesReturn.findUnique({ where: { id: refId } });
      if (!record) exists = false;
    } else if (entry.referenceType === "PAYMENT") {
      const record = await prisma.customerPayment.findUnique({ where: { id: refId } });
      if (!record) exists = false;
    } else {
      exists = false;
    }

    if (!exists) {
      invalidReferences.push({
        id: entry.id,
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
      });
    }
  }

  return {
    customerId: Number(customerId),
    customerName: customer.name,
    inSync,
    denormalizedBalance,
    ledgerSum: calculatedSum,
    drift,
    runningBalanceMismatch,
    duplicateEntriesCount: exactDuplicates,
    invalidReferences,
  };
}

/**
 * Reconciles the Supplier Ledger running balance, denormalized balance, duplicates, and broken references.
 */
async function reconcileSupplierLedger(supplierId) {
  const supplier = await prisma.supplier.findUnique({
    where: { id: Number(supplierId) },
  });
  if (!supplier) {
    throw new Error("Supplier not found.");
  }

  const entries = await prisma.supplierLedger.findMany({
    where: { supplierId: Number(supplierId) },
    orderBy: { createdAt: "asc" },
  });

  let calculatedSum = 0;
  let runningBalanceMismatch = false;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    calculatedSum += Number(entry.credit) - Number(entry.debit);
    if (Math.abs(calculatedSum - Number(entry.balance)) > 0.01) {
      runningBalanceMismatch = true;
    }
  }

  const denormalizedBalance = Number(supplier.balance);
  const drift = Math.abs(denormalizedBalance - calculatedSum);
  const inSync = drift < 0.01 && !runningBalanceMismatch;

  let exactDuplicates = 0;
  const entryKeys = new Set();
  for (const entry of entries) {
    const key = `${entry.referenceType}-${entry.referenceId}-${entry.debit}-${entry.credit}-${entry.notes}`;
    if (entryKeys.has(key)) {
      exactDuplicates++;
    } else {
      entryKeys.add(key);
    }
  }

  const invalidReferences = [];
  for (const entry of entries) {
    let exists = true;
    const refId = Number(entry.referenceId);

    if (entry.referenceType === "PURCHASE") {
      const record = await prisma.purchase.findUnique({ where: { id: refId } });
      if (!record) {
        const payRecord = await prisma.supplierPayment.findUnique({ where: { id: refId } });
        if (!payRecord) exists = false;
      }
    } else if (entry.referenceType === "PURCHASE_RETURN") {
      const record = await prisma.purchaseReturn.findUnique({ where: { id: refId } });
      if (!record) exists = false;
    } else if (entry.referenceType === "PAYMENT") {
      const record = await prisma.supplierPayment.findUnique({ where: { id: refId } });
      if (!record) exists = false;
    } else {
      exists = false;
    }

    if (!exists) {
      invalidReferences.push({
        id: entry.id,
        referenceType: entry.referenceType,
        referenceId: entry.referenceId,
      });
    }
  }

  return {
    supplierId: Number(supplierId),
    supplierName: supplier.name,
    inSync,
    denormalizedBalance,
    ledgerSum: calculatedSum,
    drift,
    runningBalanceMismatch,
    duplicateEntriesCount: exactDuplicates,
    invalidReferences,
  };
}

module.exports = {
  recordSupplierLedgerEntry,
  recordCustomerLedgerEntry,
  reconcileCustomerLedger,
  reconcileSupplierLedger,
};
