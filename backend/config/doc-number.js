/**
 * Generates an atomic, sequential document number with a prefix and zero-padded sequence.
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
    purchaseReturn: "returnNo"
  };
  const colName = colMap[modelName];
  if (!colName) {
    throw new Error(`Unsupported model name for document numbering: ${modelName}`);
  }

  const lastRecord = await tx[modelName].findFirst({
    orderBy: { id: "desc" }
  });

  let next = 1;
  if (lastRecord && lastRecord[colName]) {
    const parts = lastRecord[colName].split("-");
    const seq = parseInt(parts[1], 10);
    if (!isNaN(seq)) {
      next = seq + 1;
    }
  }

  return `${prefix}-${String(next).padStart(padLength, "0")}`;
}

module.exports = { generateDocNumber };
