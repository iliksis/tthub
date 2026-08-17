-- CreateTable
CREATE TABLE "Standing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "updatedAt" DATETIME NOT NULL,
    "teamId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "teamName" TEXT NOT NULL,
    "wins" INTEGER NOT NULL,
    "draws" INTEGER NOT NULL,
    "undecided" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "matchesWon" INTEGER NOT NULL,
    "matchesLost" INTEGER NOT NULL,
    "diff" INTEGER NOT NULL,
    "pointsWon" INTEGER NOT NULL,
    "pointsLost" INTEGER NOT NULL,
    CONSTRAINT "Standing_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Standing_teamId_teamName_key" ON "Standing"("teamId", "teamName");
