/*
  Warnings:

  - You are about to drop the column `shortId` on the `Plant` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `Plant` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Plant_shortId_key";

-- DropIndex
DROP INDEX "Plant_userId_idx";

-- AlterTable
ALTER TABLE "Plant" DROP COLUMN "shortId";

-- CreateIndex
CREATE UNIQUE INDEX "Plant_userId_key" ON "Plant"("userId");
