require("dotenv").config();
const prisma = require("../config/prisma");

/**
 * One-time historical reconciliation script.
 *
 * The purchase-return-model.js code fix (which updates Purchase.balanceDue and status
 * when a return is processed) was applied AFTER existing returns were already created.
 * This script retroactively reconciles all purchases that have returns recorded against
 * them, setting their balanceDue and status to the correct values.
 *
 * Logic: For each purchase, sum all associated purchase return amounts. Subtract from
 * the original balanceDue. Re-derive status from the new balanceDue.
 *
 * This is idempotent — safe to run multiple times.
 */
async function main() {
  console.log("=== RECONCILE PURCHASE RETURN STATUS ===\n");

  // Find all purchases that have at least one return recorded
  const purchasesWithReturns = await prisma.purchase.findMany({
    where: {
      returns: { some: {} },
    },
    include: {
      returns: {
        select: { totalAmount: true, returnNo: true },
      },
    },
    orderBy: { purchaseDate: "asc" },
  });

  if (purchasesWithReturns.length === 0) {
    console.log("No purchases with returns found. Nothing to do.");
    await prisma.$disconnect();
    return;
  }

  let fixed = 0;
  let alreadyCorrect = 0;

  for (const purchase of purchasesWithReturns) {
    const totalReturned = purchase.returns.reduce((s, r) => s + Number(r.totalAmount), 0);
    const returnNos = purchase.returns.map((r) => r.returnNo).join(", ");

    // Correct balanceDue = original balanceDue minus what was returned.
    // Note: balanceDue was set at purchase creation time based on paidAmount + creditApplied.
    // Returns FURTHER reduce that liability.
    // We recompute from scratch: total - paidAmount - creditApplied - totalReturned
    const correctBalanceDue = Math.max(
      0,
      Number(purchase.total) - Number(purchase.paidAmount) - Number(purchase.creditApplied) - totalReturned
    );

    const correctStatus =
      correctBalanceDue <= 0
        ? "PAID"
        : correctBalanceDue < Number(purchase.total)
        ? "PARTIALLY_PAID"
        : "UNPAID";

    const currentBalanceDue = Number(purchase.balanceDue);
    const currentStatus = purchase.status;

    if (
      Math.abs(currentBalanceDue - correctBalanceDue) < 0.01 &&
      currentStatus === correctStatus
    ) {
      console.log(
        `  OK    ${purchase.purchaseNo}: already correct — balanceDue=${correctBalanceDue}, status=${correctStatus} [returns: ${returnNos}]`
      );
      alreadyCorrect++;
      continue;
    }

    await prisma.purchase.update({
      where: { id: purchase.id },
      data: { balanceDue: correctBalanceDue, status: correctStatus },
    });

    console.log(
      `  FIXED ${purchase.purchaseNo}: balanceDue ${currentBalanceDue} → ${correctBalanceDue}  |  status ${currentStatus} → ${correctStatus}  [returns: ${returnNos}, totalReturned=${totalReturned}]`
    );
    fixed++;
  }

  console.log(`\n--- Done: ${fixed} fixed, ${alreadyCorrect} already correct ---\n`);

  // Verify the specific purchase the user reported
  const pur3 = await prisma.purchase.findFirst({
    where: { purchaseNo: "PUR-000003" },
    select: { purchaseNo: true, total: true, balanceDue: true, status: true },
  });
  if (pur3) {
    console.log(`Verification — ${pur3.purchaseNo}: total=${pur3.total}  balanceDue=${pur3.balanceDue}  status=${pur3.status}`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Reconciliation failed:", err);
  process.exit(1);
});
