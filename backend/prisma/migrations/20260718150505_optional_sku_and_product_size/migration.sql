-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "size" TEXT,
ALTER COLUMN "sku" DROP NOT NULL;
