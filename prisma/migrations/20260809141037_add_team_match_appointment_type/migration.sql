-- AlterTable
ALTER TABLE "Team" ADD COLUMN "clickTTTeamId" TEXT;

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
    CONSTRAINT "Appointment_nextAppointmentId_fkey" FOREIGN KEY ("nextAppointmentId") REFERENCES "Appointment" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Appointment_ownTeamId_fkey" FOREIGN KEY ("ownTeamId") REFERENCES "Team" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("createdAt", "deletedAt", "endDate", "id", "link", "location", "nextAppointmentId", "shortTitle", "startDate", "status", "title", "type") SELECT "createdAt", "deletedAt", "endDate", "id", "link", "location", "nextAppointmentId", "shortTitle", "startDate", "status", "title", "type" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Team_clickTTTeamId_key" ON "Team"("clickTTTeamId");
