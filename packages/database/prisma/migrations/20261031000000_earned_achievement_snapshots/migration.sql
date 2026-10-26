BEGIN;
DROP TRIGGER "AchievementAward_immutable" ON "AchievementAward";
ALTER TABLE "AchievementAward"
    ADD COLUMN "title" TEXT,
    ADD COLUMN "description" TEXT,
    ADD COLUMN "target" INTEGER;
UPDATE "AchievementAward" AS award
SET "title" = definition."title", "description" = definition."description", "target" = definition."target"
FROM "AchievementDefinition" AS definition
WHERE award."scope" = definition."scope" AND award."key" = definition."key" AND award."version" = definition."version";
-- Pending progress is derived on reads; only earned snapshots are history.
DELETE FROM "AchievementAward" WHERE "awardedAt" IS NULL;
ALTER TABLE "AchievementAward"
    DROP CONSTRAINT "AchievementAward_scope_key_version_fkey",
    DROP CONSTRAINT "AchievementAward_scope_key_version_subjectId_key",
    DROP CONSTRAINT "AchievementAward_check",
    DROP CONSTRAINT "AchievementAward_check1",
    DROP COLUMN "scope",
    DROP COLUMN "subjectId",
    DROP COLUMN "computedAt",
    ALTER COLUMN "title" SET NOT NULL,
    ALTER COLUMN "description" SET NOT NULL,
    ALTER COLUMN "target" SET NOT NULL,
    ALTER COLUMN "progress" SET NOT NULL,
    ALTER COLUMN "awardedAt" SET NOT NULL,
    ALTER COLUMN "awardedAt" SET DEFAULT CURRENT_TIMESTAMP,
    ADD CHECK ("version" > 0),
    ADD CHECK ("target" > 0),
    ADD CHECK (num_nonnulls("userId", "clubId") = 1);
CREATE UNIQUE INDEX "AchievementAward_key_version_userId_key" ON "AchievementAward"("key", "version", "userId");
CREATE UNIQUE INDEX "AchievementAward_key_version_clubId_key" ON "AchievementAward"("key", "version", "clubId");
DROP TABLE "AchievementDefinition";
CREATE OR REPLACE FUNCTION preserve_achievement_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Achievement history is immutable; create a new rule version';
END;
$$;
CREATE TRIGGER "AchievementAward_immutable" BEFORE UPDATE ON "AchievementAward"
    FOR EACH ROW EXECUTE FUNCTION preserve_achievement_history();
COMMIT;
