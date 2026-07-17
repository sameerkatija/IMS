-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "creditApplied" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "SalesReturn" ADD COLUMN     "refundType" TEXT NOT NULL DEFAULT 'CREDIT';
