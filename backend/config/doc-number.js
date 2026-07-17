/**
 * Generates an atomic, sequential document number with a prefix and zero-padded sequence.
 * @param {object} tx - Prisma transaction client
 * @param {string} modelName - Prisma model key (e.g. 'purchase', 'purchaseReturn')
 * @param {string} prefix - The prefix of the document code (e.g. 'PUR', 'PR')
 * @param {number} padLength - Length to pad sequence with leading zeros
 * @returns {Promise<string>} Sequential document identifier
 */
async function generateDocNumber(tx, modelName, prefix, padLength = 6) {
  const count = await tx[modelName].count();
  const next = count + 1;
  return `${prefix}-${String(next).padStart(padLength, "0")}`;
}

module.exports = { generateDocNumber };
