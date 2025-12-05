-- AlterTable
ALTER TABLE "final"."User" ADD COLUMN     "encryptedData" BYTEA,
ADD COLUMN     "encryptedDataIV" BYTEA,
ADD COLUMN     "wrappedDEK" BYTEA,
ADD COLUMN     "wrappedDEKIV" BYTEA;
