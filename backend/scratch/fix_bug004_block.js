const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "qa_full_audit.js");
let content = fs.readFileSync(filePath, "utf8");

// The broken line starts with this text on one line (all escaped \n are literal backslash-n characters)
const brokenPattern = /    const supplierAfter = await prisma\.supplier\.findUnique\(\{ where: \{ id: supplier\.id \} \}\);\\n.*?  \} catch \(err\) \{/s;

const replacement = `    const supplierAfter = await prisma.supplier.findUnique({ where: { id: supplier.id } });
    // After createPurchase the purchase ledger correctly moved balance: -200 to -100
    // isCreditApplied must NOT post another entry, so balance stays at -100
    if (!ledgerEntry && Number(supplierAfter.balance) === -100.00) {
      log("[BUG-004] recordSupplierPayment isCreditApplied does NOT post extra ledger entry (no balance drift)", "PASS");
    } else if (ledgerEntry) {
      log("[BUG-004] recordSupplierPayment isCreditApplied does NOT post extra ledger entry (no balance drift)", "FAIL", \`Spurious ledger entry found (debit=\${ledgerEntry.debit}, credit=\${ledgerEntry.credit}) - double entry!\`);
    } else {
      log("[BUG-004] recordSupplierPayment isCreditApplied does NOT post extra ledger entry (no balance drift)", "FAIL", \`Balance drifted: expected -100 (after purchase credit), got \${supplierAfter.balance}\`);
    }
  } catch (err) {`;

const newContent = content.replace(brokenPattern, replacement);
if (newContent === content) {
  console.log("Pattern NOT matched - no change made");
} else {
  fs.writeFileSync(filePath, newContent, "utf8");
  console.log("Fixed BUG-004 block.");
}
