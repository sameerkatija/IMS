-- AlterTable
ALTER TABLE "PurchaseReturn" ADD COLUMN     "deductionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SalesReturn" ADD COLUMN     "deductionAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
