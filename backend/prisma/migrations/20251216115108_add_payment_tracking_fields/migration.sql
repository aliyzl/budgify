-- AlterTable
ALTER TABLE "requests" ADD COLUMN     "exchangeRate" DECIMAL(65,30),
ADD COLUMN     "localCost" DECIMAL(65,30),
ADD COLUMN     "paymentCardId" TEXT;
