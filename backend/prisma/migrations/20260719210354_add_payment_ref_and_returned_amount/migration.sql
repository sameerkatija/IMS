-- AlterEnum
ALTER TYPE "ReferenceType" ADD VALUE 'PAYMENT';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "returnedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "returnedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;
