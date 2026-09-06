-- Collapse the TOURNAMENT_DE variant into TOURNAMENT (see docs/adr/0002):
-- region is now expressed as a Label, not an appointment type. No labels
-- are attached to these rows as part of this migration.
UPDATE "Appointment" SET "type" = 'TOURNAMENT' WHERE "type" = 'TOURNAMENT_DE';

-- CreateTable
CREATE TABLE "Label" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "AppointmentLabel" (
    "appointmentId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,

    PRIMARY KEY ("appointmentId", "labelId"),
    CONSTRAINT "AppointmentLabel_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AppointmentLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
INSERT INTO "new_Appointment" ("awayTeam", "createdAt", "deletedAt", "endDate", "homeTeam", "id", "link", "location", "nextAppointmentId", "ownTeamId", "seasonId", "startDate", "status", "title", "type") SELECT "awayTeam", "createdAt", "deletedAt", "endDate", "homeTeam", "id", "link", "location", "nextAppointmentId", "ownTeamId", "seasonId", "startDate", "status", "title", "type" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
