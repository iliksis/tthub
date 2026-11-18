-- AlterTable
ALTER TABLE "Player" ADD COLUMN "myTischtennisId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Player_myTischtennisId_key" ON "Player"("myTischtennisId");
