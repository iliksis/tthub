-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TeamPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    CONSTRAINT "TeamPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamPlayer_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TeamPlayer" ("createdAt", "id", "playerId", "seasonId", "teamId") SELECT "createdAt", "id", "playerId", "seasonId", "teamId" FROM "TeamPlayer";
DROP TABLE "TeamPlayer";
ALTER TABLE "new_TeamPlayer" RENAME TO "TeamPlayer";
CREATE UNIQUE INDEX "TeamPlayer_playerId_seasonId_key" ON "TeamPlayer"("playerId", "seasonId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
