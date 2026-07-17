-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "ExpenseCategory" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;
