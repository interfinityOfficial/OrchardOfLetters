-- CreateTable
CREATE TABLE "PlantWord" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlantWord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlantWord_plantId_idx" ON "PlantWord"("plantId");

-- CreateIndex
CREATE UNIQUE INDEX "PlantWord_plantId_word_key" ON "PlantWord"("plantId", "word");

-- AddForeignKey
ALTER TABLE "PlantWord" ADD CONSTRAINT "PlantWord_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
