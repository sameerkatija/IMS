/*
  Warnings:

  - You are about to drop the column `invoiceId` on the `CustomerPayment` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "CustomerPayment" DROP CONSTRAINT "CustomerPayment_invoiceId_fkey";

-- DropIndex
DROP INDEX "CustomerPayment_invoiceId_idx";

-- AlterTable
ALTER TABLE "CustomerPayment" DROP COLUMN "invoiceId";
