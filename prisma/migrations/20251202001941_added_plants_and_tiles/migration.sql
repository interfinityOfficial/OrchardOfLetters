-- CreateTable
CREATE TABLE "final"."Plant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Plant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "final"."Tile" (
    "id" TEXT NOT NULL,
    "plantId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "letter" CHAR(1) NOT NULL,
    "isSeed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Tile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Plant_userId_key" ON "final"."Plant"("userId");

-- CreateIndex
CREATE INDEX "Tile_plantId_idx" ON "final"."Tile"("plantId");

-- CreateIndex
CREATE UNIQUE INDEX "Tile_plantId_x_y_key" ON "final"."Tile"("plantId", "x", "y");

-- AddForeignKey
ALTER TABLE "final"."Plant" ADD CONSTRAINT "Plant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "final"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "final"."Tile" ADD CONSTRAINT "Tile_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "final"."Plant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
