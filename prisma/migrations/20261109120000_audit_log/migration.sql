-- Replace the Appointment-only "Transaction" journal with the entity-agnostic
-- "AuditLog" (docs/adr/0005). Existing rows are copied with their ids,
-- timestamps, user and changes; every one of them concerns an Appointment.
-- Back up the production database before deploying this migration.

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "changes" JSONB,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CopyRows
INSERT INTO "AuditLog" ("id", "createdAt", "entityType", "entityId", "userId", "action", "changes")
SELECT "id", "createdAt", 'Appointment', "appointmentId", "userId", "type", "changes"
FROM "Transaction";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Transaction";
PRAGMA foreign_keys=on;

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
