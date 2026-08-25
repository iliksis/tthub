-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false
);

-- CreateTable
CREATE TABLE "TeamPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "teamId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    CONSTRAINT "TeamPlayer_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TeamPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "title" TEXT NOT NULL,
    "shortTitle" TEXT NOT NULL,
    "location" TEXT,
    "link" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT,
    "nextAppointmentId" TEXT,
    "ownTeamId" TEXT,
    "homeTeam" TEXT,
    "awayTeam" TEXT,
    "seasonId" TEXT,
    CONSTRAINT "Appointment_nextAppointmentId_fkey" FOREIGN KEY ("nextAppointmentId") REFERENCES "Appointment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_ownTeamId_fkey" FOREIGN KEY ("ownTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("awayTeam", "createdAt", "deletedAt", "endDate", "homeTeam", "id", "link", "location", "nextAppointmentId", "ownTeamId", "shortTitle", "startDate", "status", "title", "type") SELECT "awayTeam", "createdAt", "deletedAt", "endDate", "homeTeam", "id", "link", "location", "nextAppointmentId", "ownTeamId", "shortTitle", "startDate", "status", "title", "type" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "league" TEXT,
    "placement" TEXT,
    "clickTTGroupId" TEXT,
    "seasonId" TEXT,
    CONSTRAINT "Team_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("clickTTGroupId", "createdAt", "id", "league", "placement", "title") SELECT "clickTTGroupId", "createdAt", "id", "league", "placement", "title" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_clickTTGroupId_seasonId_key" ON "Team"("clickTTGroupId", "seasonId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TeamPlayer_playerId_seasonId_key" ON "TeamPlayer"("playerId", "seasonId");
