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

module.exports = {
  recordSupplierLedgerEntry,
  recordCustomerLedgerEntry,
};
