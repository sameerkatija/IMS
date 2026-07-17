-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "balanceDue" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID';
