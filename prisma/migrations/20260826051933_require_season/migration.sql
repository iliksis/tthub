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
INSERT INTO "new_Appointment" ("awayTeam", "createdAt", "deletedAt", "endDate", "homeTeam", "id", "link", "location", "nextAppointmentId", "ownTeamId", "seasonId", "shortTitle", "startDate", "status", "title", "type") SELECT "awayTeam", "createdAt", "deletedAt", "endDate", "homeTeam", "id", "link", "location", "nextAppointmentId", "ownTeamId", "seasonId", "shortTitle", "startDate", "status", "title", "type" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
CREATE TABLE "new_Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "qttr" INTEGER NOT NULL
);
INSERT INTO "new_Player" ("createdAt", "id", "name", "qttr", "updatedAt", "year") SELECT "createdAt", "id", "name", "qttr", "updatedAt", "year" FROM "Player";
DROP TABLE "Player";
ALTER TABLE "new_Player" RENAME TO "Player";
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
INSERT INTO "new_Team" ("clickTTGroupId", "createdAt", "id", "league", "placement", "seasonId", "title") SELECT "clickTTGroupId", "createdAt", "id", "league", "placement", "seasonId", "title" FROM "Team";
DROP TABLE "Team";
ALTER TABLE "new_Team" RENAME TO "Team";
CREATE UNIQUE INDEX "Team_clickTTGroupId_seasonId_key" ON "Team"("clickTTGroupId", "seasonId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

