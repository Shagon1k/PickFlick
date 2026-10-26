BEGIN;
CREATE TABLE "AchievementDefinition" (
    "scope" TEXT NOT NULL CHECK ("scope" IN ('CLUB', 'PERSONAL')),
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL CHECK ("version" > 0),
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "target" INTEGER NOT NULL CHECK ("target" > 0),
    PRIMARY KEY ("scope", "key", "version")
);
CREATE TABLE "AchievementAward" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "scope" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "subjectId" UUID NOT NULL,
    "userId" UUID REFERENCES "User"("id") ON DELETE CASCADE,
    "clubId" UUID REFERENCES "Club"("id") ON DELETE CASCADE,
    "progress" INTEGER CHECK ("progress" >= 0),
    "explanation" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "computedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "awardedAt" TIMESTAMPTZ(3),
    FOREIGN KEY ("scope", "key", "version") REFERENCES "AchievementDefinition"("scope", "key", "version"),
    UNIQUE ("scope", "key", "version", "subjectId"),
    CHECK (("scope" = 'PERSONAL' AND "userId" = "subjectId" AND "userId" IS NOT NULL AND "clubId" IS NULL)
        OR ("scope" = 'CLUB' AND "clubId" = "subjectId" AND "clubId" IS NOT NULL AND "userId" IS NULL)),
    CHECK ("awardedAt" IS NULL OR "progress" IS NOT NULL)
);
CREATE INDEX "AchievementAward_userId_idx" ON "AchievementAward"("userId");
CREATE INDEX "AchievementAward_clubId_idx" ON "AchievementAward"("clubId");
CREATE FUNCTION preserve_achievement_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_TABLE_NAME = 'AchievementDefinition' OR OLD."awardedAt" IS NOT NULL THEN
        RAISE EXCEPTION 'Achievement history is immutable; create a new rule version';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "AchievementDefinition_immutable" BEFORE UPDATE ON "AchievementDefinition"
    FOR EACH ROW EXECUTE FUNCTION preserve_achievement_history();
CREATE TRIGGER "AchievementAward_immutable" BEFORE UPDATE ON "AchievementAward"
    FOR EACH ROW EXECUTE FUNCTION preserve_achievement_history();
COMMIT;
