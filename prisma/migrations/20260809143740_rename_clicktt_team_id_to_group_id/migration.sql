-- RenameColumn
ALTER TABLE "Team" RENAME COLUMN "clickTTTeamId" TO "clickTTGroupId";

-- RenameIndex
DROP INDEX "Team_clickTTTeamId_key";
CREATE UNIQUE INDEX "Team_clickTTGroupId_key" ON "Team"("clickTTGroupId");
