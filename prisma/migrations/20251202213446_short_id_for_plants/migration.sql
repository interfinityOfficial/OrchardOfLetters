/*
  Warnings:

  - A unique constraint covering the columns `[shortId]` on the table `Plant` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `shortId` to the `Plant` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Plant_userId_key";

-- AlterTable
ALTER TABLE "Plant" ADD COLUMN     "shortId" VARCHAR(8) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Plant_shortId_key" ON "Plant"("shortId");

-- CreateIndex
CREATE INDEX "Plant_userId_idx" ON "Plant"("userId");
