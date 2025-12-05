/*
  Warnings:

  - You are about to drop the column `encryptedData` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `encryptedDataIV` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `wrappedDEK` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `wrappedDEKIV` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "final"."User" DROP COLUMN "encryptedData",
DROP COLUMN "encryptedDataIV",
DROP COLUMN "wrappedDEK",
DROP COLUMN "wrappedDEKIV";
