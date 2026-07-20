/*
  Warnings:

  - The `paymentType` column on the `CustomerPayment` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `refundType` column on the `SalesReturn` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Added the required column `costPriceAtSale` to the `SalesReturnItem` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CustomerPaymentType" AS ENUM ('CASH', 'CREDIT_APPLICATION', 'CASH_REFUND');

-- CreateEnum
CREATE TYPE "SupplierPaymentType" AS ENUM ('NORMAL', 'ADVANCE');

-- CreateEnum
CREATE TYPE "SalesReturnRefundType" AS ENUM ('CASH', 'CREDIT');

-- AlterTable
ALTER TABLE "CustomerPayment" DROP COLUMN "paymentType",
ADD COLUMN     "paymentType" "CustomerPaymentType" NOT NULL DEFAULT 'CASH';

-- AlterTable
ALTER TABLE "SalesReturn" DROP COLUMN "refundType",
ADD COLUMN     "refundType" "SalesReturnRefundType" NOT NULL DEFAULT 'CREDIT';

-- AlterTable
ALTER TABLE "SalesReturnItem" ADD COLUMN     "costPriceAtSale" DECIMAL(12,2) NOT NULL;

-- AlterTable
ALTER TABLE "SupplierPayment" ADD COLUMN     "paymentType" "SupplierPaymentType" NOT NULL DEFAULT 'NORMAL';

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "operation" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("operation","key")
);

-- CreateIndex
CREATE INDEX "CustomerLedger_customerId_createdAt_idx" ON "CustomerLedger"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerLedger_createdAt_idx" ON "CustomerLedger"("createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_productId_createdAt_idx" ON "StockMovement"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "StockMovement_createdAt_idx" ON "StockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "SupplierLedger_supplierId_createdAt_idx" ON "SupplierLedger"("supplierId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierLedger_createdAt_idx" ON "SupplierLedger"("createdAt");
