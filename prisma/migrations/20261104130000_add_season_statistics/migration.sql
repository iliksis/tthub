-- CreateTable
CREATE TABLE "SeasonStatistics" (
    "seasonId" TEXT NOT NULL PRIMARY KEY,
    "playerCount" INTEGER,
    "eligibleCount" INTEGER NOT NULL,
    "eligibleMaleCount" INTEGER NOT NULL,
    "eligibleFemaleCount" INTEGER NOT NULL,
    "breakdown" JSONB,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SeasonStatistics_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Backfill: past Seasons get the legacy counts (distinct Players with a
-- roster membership or a Placement on a non-deleted Appointment in the
-- Season; Players without a gender only count towards the total). The
-- all-Player count and the breakdown stay untracked (NULL).
INSERT INTO "SeasonStatistics" ("seasonId", "playerCount", "eligibleCount", "eligibleMaleCount", "eligibleFemaleCount", "breakdown")
SELECT
    s."id",
    NULL,
    COUNT(p."id"),
    COALESCE(SUM(CASE WHEN p."gender" = 'MALE' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN p."gender" = 'FEMALE' THEN 1 ELSE 0 END), 0),
    NULL
FROM "Season" s
LEFT JOIN "Player" p ON p."id" IN (
    SELECT tp."playerId" FROM "TeamPlayer" tp WHERE tp."seasonId" = s."id"
    UNION
    SELECT pl."playerId" FROM "Placement" pl
    JOIN "Appointment" a ON a."id" = pl."appointmentId"
    WHERE a."seasonId" = s."id" AND a."deletedAt" IS NULL
)
WHERE s."isActive" = false
GROUP BY s."id";

-- Backfill: the Active Season gets the all-Player count and zero eligible
-- counts; the first recompute fills in the rest.
INSERT INTO "SeasonStatistics" ("seasonId", "playerCount", "eligibleCount", "eligibleMaleCount", "eligibleFemaleCount", "breakdown")
SELECT s."id", (SELECT COUNT(*) FROM "Player"), 0, 0, 0, NULL
FROM "Season" s
WHERE s."isActive" = true;
