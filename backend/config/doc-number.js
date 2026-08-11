/**
 * Generates an atomic, sequential document number with a prefix and zero-padded sequence.
 *
 * CONCURRENCY SAFETY (CRIT-03 fix):
 * Uses pg_advisory_xact_lock() to serialize concurrent calls within the same transaction
 * isolation level. The lock is transaction-scoped and released automatically on commit/rollback.
 * This prevents two simultaneous invoice creations from generating the same sequence number.
 *
 * @param {object} tx - Prisma transaction client
 * @param {string} modelName - Prisma model key (e.g. 'purchase', 'purchaseReturn')
 * @param {string} prefix - The prefix of the document code (e.g. 'PUR', 'PR')
 * @param {number} padLength - Length to pad sequence with leading zeros
 * @returns {Promise<string>} Sequential document identifier
 */
async function generateDocNumber(tx, modelName, prefix, padLength = 6) {
  const colMap = {
    invoice: "invoiceNo",
    purchase: "purchaseNo",
    salesReturn: "returnNo",
    purchaseReturn: "returnNo",
  };

  // Stable integer lock IDs per document type (must be unique across document types)
  const lockIds = {
    invoice: 1001,
    purchase: 1002,
    salesReturn: 1003,
    purchaseReturn: 1004,
  };

  const colName = colMap[modelName];
  const lockId = lockIds[modelName];

  if (!colName || !lockId) {
    throw new Error(`Unsupported model name for document numbering: ${modelName}`);
  }

  // Acquire a PostgreSQL transaction-scoped advisory lock.
  // All concurrent transactions for the same document type must wait here,
  // eliminating the race condition in sequence generation.
  // NOTE: pg_advisory_xact_lock returns void, so we use $executeRawUnsafe (not $queryRawUnsafe)
  // to avoid Prisma's void-deserialization error.
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${lockId})`);


  // Now safely read the latest record — no concurrent write can interfere
  const lastRecord = await tx[modelName].findFirst({
    orderBy: { id: "desc" },
  });

  let next = 1;
  if (lastRecord && lastRecord[colName]) {
    const docNo = lastRecord[colName];
    const parts = docNo.split("-");
    // LOW-02 fix: parse the LAST segment to handle any prefix format robustly
    const seqPart = parts[parts.length - 1];
    const seq = parseInt(seqPart, 10);

    if (!isNaN(seq)) {
      next = seq + 1;
    } else {
      // Non-standard format fallback: scan all records to find the true maximum sequence
      console.warn(`[doc-number] Non-standard document number format detected: "${docNo}". Scanning all records for max sequence.`);
      const allRecords = await tx[modelName].findMany({
        select: { [colName]: true },
      });
      const maxSeq = allRecords.reduce((max, r) => {
        const p = (r[colName] || "").split("-");
        const n = parseInt(p[p.length - 1], 10);
        return isNaN(n) ? max : Math.max(max, n);
      }, 0);
      next = maxSeq + 1;
    }
  }

  return `${prefix}-${String(next).padStart(padLength, "0")}`;
}

module.exports = { generateDocNumber };
