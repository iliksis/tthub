-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false
);

-- Seed a legacy season for any pre-existing data. Harmless on a fresh
-- database (nothing to backfill below); wiped by prisma/seed.ts's
-- season.deleteMany() in every seeded environment (dev seed, e2e).
INSERT INTO "Season" ("id", "name", "isActive") VALUES ('legacyS', 'Bestand', true);

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

-- Backfill roster history from the existing Player.teamId column before
-- it gets dropped below.
INSERT INTO "TeamPlayer" ("id", "teamId", "playerId", "seasonId")
SELECT lower(hex(randomblob(6))), "teamId", "id", 'legacyS'
FROM "Player" WHERE "teamId" IS NOT NULL;

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
    "seasonId" TEXT NOT NULL,
    CONSTRAINT "Appointment_nextAppointmentId_fkey" FOREIGN KEY ("nextAppointmentId") REFERENCES "Appointment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_ownTeamId_fkey" FOREIGN KEY ("ownTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("id", "createdAt", "deletedAt", "startDate", "endDate", "title", "shortTitle", "location", "link", "type", "status", "nextAppointmentId", "ownTeamId", "homeTeam", "awayTeam", "seasonId")
SELECT "id", "createdAt", "deletedAt", "startDate", "endDate", "title", "shortTitle", "location", "link", "type", "status", "nextAppointmentId", "ownTeamId", "homeTeam", "awayTeam", 'legacyS'
FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
CREATE TABLE "new_Team" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "league" TEXT,
    "placement" TEXT,
    "clickTTGroupId" TEXT,
    "seasonId" TEXT NOT NULL,
    CONSTRAINT "Team_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Team" ("id", "createdAt", "title", "league", "placement", "clickTTGroupId", "seasonId")
SELECT "id", "createdAt", "title", "league", "placement", "clickTTGroupId", 'legacyS'
FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_clickTTGroupId_seasonId_key" ON "Team"("clickTTGroupId", "seasonId");
CREATE TABLE "new_Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "qttr" INTEGER NOT NULL
);
INSERT INTO "new_Player" ("id", "createdAt", "updatedAt", "name", "year", "qttr")
SELECT "id", "createdAt", "updatedAt", "name", "year", "qttr"
FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TeamPlayer_playerId_seasonId_key" ON "TeamPlayer"("playerId", "seasonId");
