-- DropIndex
DROP INDEX "TeamPlayer_playerId_seasonId_key";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "league" TEXT,
    "placement" TEXT,
    "clickTTGroupId" TEXT,
    "seasonId" TEXT NOT NULL,
    "half" TEXT,
    "hinrundeTeamId" TEXT,
    CONSTRAINT "Team_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Team_hinrundeTeamId_fkey" FOREIGN KEY ("hinrundeTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("clickTTGroupId", "createdAt", "id", "league", "placement", "seasonId", "title") SELECT "clickTTGroupId", "createdAt", "id", "league", "placement", "seasonId", "title" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_hinrundeTeamId_key" ON "Team"("hinrundeTeamId");
CREATE UNIQUE INDEX "Team_clickTTGroupId_seasonId_key" ON "Team"("clickTTGroupId", "seasonId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TeamPlayer_playerId_teamId_key" ON "TeamPlayer"("playerId", "teamId");

