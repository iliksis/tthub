-- Add Label.priority, backfilled by createdAt ascending (ties broken by id)
-- so existing labels start in a stable, reviewable order.
ALTER TABLE "Label" ADD COLUMN "priority" INTEGER NOT NULL DEFAULT 0;

UPDATE "Label"
SET "priority" = (
    SELECT COUNT(*)
    FROM "Label" AS "l2"
    WHERE "l2"."createdAt" < "Label"."createdAt"
       OR ("l2"."createdAt" = "Label"."createdAt" AND "l2"."id" < "Label"."id")
);
