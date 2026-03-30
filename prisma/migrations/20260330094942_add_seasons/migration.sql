-- CreateTable
CREATE TABLE "Season" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SeasonAgeGroupCount" (
    "seasonId" TEXT NOT NULL,
    "ageGroup" TEXT NOT NULL,
    "playerCount" INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY ("seasonId", "ageGroup"),
    CONSTRAINT "SeasonAgeGroupCount_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Season_title_key" ON "Season"("title");
