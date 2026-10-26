BEGIN;
CREATE TABLE "AchievementAward" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "version" INTEGER NOT NULL CHECK ("version" > 0),
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "target" INTEGER NOT NULL CHECK ("target" > 0),
    "private" BOOLEAN NOT NULL DEFAULT false,
    "userId" UUID REFERENCES "User"("id") ON DELETE CASCADE,
    "clubId" UUID REFERENCES "Club"("id") ON DELETE CASCADE,
    "progress" INTEGER NOT NULL CHECK ("progress" >= 0),
    "explanation" TEXT NOT NULL,
    "evidence" JSONB NOT NULL,
    "awardedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (num_nonnulls("userId", "clubId") = 1)
);
CREATE UNIQUE INDEX "AchievementAward_key_version_userId_key" ON "AchievementAward"("key", "version", "userId");
CREATE UNIQUE INDEX "AchievementAward_key_version_clubId_key" ON "AchievementAward"("key", "version", "clubId");
CREATE INDEX "AchievementAward_userId_idx" ON "AchievementAward"("userId");
CREATE INDEX "AchievementAward_clubId_idx" ON "AchievementAward"("clubId");
CREATE FUNCTION preserve_achievement_history() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Achievement history is immutable; create a new rule version';
END;
$$;
CREATE TRIGGER "AchievementAward_immutable" BEFORE UPDATE ON "AchievementAward"
    FOR EACH ROW EXECUTE FUNCTION preserve_achievement_history();
COMMIT;
