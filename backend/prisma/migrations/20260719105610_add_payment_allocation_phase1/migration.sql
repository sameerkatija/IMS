/*
  Warnings:

  - You are about to drop the column `deductionAmount` on the `PurchaseReturn` table. All the data in the column will be lost.
  - You are about to drop the column `deductionAmount` on the `SalesReturn` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PurchaseReturn" DROP COLUMN "deductionAmount";

-- AlterTable
ALTER TABLE "SalesReturn" DROP COLUMN "deductionAmount";

-- CreateTable
CREATE TABLE "PaymentAllocation" (
    "id" SERIAL NOT NULL,
    "customerPaymentId" INTEGER NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "amountAllocated" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentAllocation_customerPaymentId_idx" ON "PaymentAllocation"("customerPaymentId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "PaymentAllocation"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAllocation_customerPaymentId_invoiceId_key" ON "PaymentAllocation"("customerPaymentId", "invoiceId");

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_customerPaymentId_fkey" FOREIGN KEY ("customerPaymentId") REFERENCES "CustomerPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
