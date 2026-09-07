-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Label" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "countsForStats" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Label" ("color", "createdAt", "id", "name", "priority") SELECT "color", "createdAt", "id", "name", "priority" FROM "Label";
DROP TABLE "Label";
ALTER TABLE "new_Label" RENAME TO "Label";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
