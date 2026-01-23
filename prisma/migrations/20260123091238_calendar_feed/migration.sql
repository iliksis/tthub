/*
  Warnings:

  - The required column `feedId` was added to the `User` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- CreateTable
CREATE TABLE "FeedConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "includeResponseTypes" TEXT,
    "includeDraftStatus" BOOLEAN NOT NULL DEFAULT false,
    "includeAppointmentTypes" TEXT,
    CONSTRAINT "FeedConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userName" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "feedId" TEXT
);
INSERT INTO "new_User" ("id", "name", "password", "role", "userName") SELECT "id", "name", "password", "role", "userName" FROM "User";
UPDATE "new_User" SET "feedId" = lower(
    hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || '4' || 
    substr(hex( randomblob(2)), 2) || '-' || 
    substr('AB89', 1 + (abs(random()) % 4) , 1)  ||
    substr(hex(randomblob(2)), 2) || '-' || 
    hex(randomblob(6))
);
CREATE TABLE "temp_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userName" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "feedId" TEXT NOT NULL
);
INSERT INTO "temp_User" ("id", "name", "password", "role", "userName", "feedId") SELECT "id", "name", "password", "role", "userName", "feedId" FROM "new_User";
DROP TABLE "User";
DROP TABLE "new_User";
ALTER TABLE "temp_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_userName_key" ON "User"("userName");
CREATE UNIQUE INDEX "User_feedId_key" ON "User"("feedId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "FeedConfig_userId_key" ON "FeedConfig"("userId");
