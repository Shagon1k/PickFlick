BEGIN;

ALTER TABLE "Session"
  ADD COLUMN "rosterVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "selectionScaleMin" INTEGER,
  ADD COLUMN "selectionScaleMax" INTEGER,
  ADD COLUMN "showNominationAuthors" BOOLEAN,
  ADD COLUMN "showNominationsBeforeSubmit" BOOLEAN,
  ADD COLUMN "showVoteResults" BOOLEAN,
  ADD COLUMN "showRatingResults" BOOLEAN,
  ADD COLUMN "useMonochromeMedia" BOOLEAN;

-- Skeleton Sessions had no snapshot. Preserve them using the current Club settings;
-- original creation-time settings cannot be reconstructed.
UPDATE "Session" AS s SET
  "selectionScaleMin" = c."selectionScaleMin",
  "selectionScaleMax" = c."selectionScaleMax",
  "showNominationAuthors" = c."showNominationAuthors",
  "showNominationsBeforeSubmit" = c."showNominationsBeforeSubmit",
  "showVoteResults" = c."showVoteResults",
  "showRatingResults" = c."showRatingResults",
  "useMonochromeMedia" = c."useMonochromeMedia"
FROM "Club" AS c WHERE s."clubId" = c.id;

ALTER TABLE "Session"
  ALTER COLUMN "selectionScaleMin" SET NOT NULL,
  ALTER COLUMN "selectionScaleMax" SET NOT NULL,
  ALTER COLUMN "showNominationAuthors" SET NOT NULL,
  ALTER COLUMN "showNominationsBeforeSubmit" SET NOT NULL,
  ALTER COLUMN "showVoteResults" SET NOT NULL,
  ALTER COLUMN "showRatingResults" SET NOT NULL,
  ALTER COLUMN "useMonochromeMedia" SET NOT NULL,
  ADD CONSTRAINT "Session_selection_scale_check" CHECK (
    "selectionScaleMin" IN (0, 1) AND "selectionScaleMax" BETWEEN 1 AND 10
    AND "selectionScaleMax" > "selectionScaleMin"
  ),
  ADD CONSTRAINT "Session_versions_check" CHECK ("phaseVersion" > 0 AND "rosterVersion" > 0);

CREATE UNIQUE INDEX "Session_id_clubId_key" ON "Session" (id, "clubId");
CREATE UNIQUE INDEX "Membership_id_clubId_key" ON "Membership" (id, "clubId");
CREATE TYPE "SessionParticipantStatus" AS ENUM ('INVITED', 'ACCEPTED', 'DECLINED', 'LEFT', 'REMOVED');

CREATE TABLE "SessionParticipant" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "sessionId" UUID NOT NULL,
  "membershipId" UUID NOT NULL,
  "clubId" UUID NOT NULL,
  status "SessionParticipantStatus" NOT NULL DEFAULT 'INVITED',
  attended BOOLEAN,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "SessionParticipant_sessionId_clubId_fkey" FOREIGN KEY ("sessionId", "clubId")
    REFERENCES "Session" (id, "clubId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SessionParticipant_membershipId_clubId_fkey" FOREIGN KEY ("membershipId", "clubId")
    REFERENCES "Membership" (id, "clubId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SessionParticipant_sessionId_membershipId_key" ON "SessionParticipant" ("sessionId", "membershipId");
CREATE UNIQUE INDEX "SessionParticipant_id_clubId_key" ON "SessionParticipant" (id, "clubId");
CREATE INDEX "SessionParticipant_membershipId_idx" ON "SessionParticipant" ("membershipId");

CREATE TABLE "SessionInvite" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tokenDigest" CHAR(64) NOT NULL,
  "participantId" UUID NOT NULL,
  "clubId" UUID NOT NULL,
  "inviterMembershipId" UUID NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "revokedAt" TIMESTAMPTZ(3),
  "respondedAt" TIMESTAMPTZ(3),
  accepted BOOLEAN,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SessionInvite_participantId_clubId_fkey" FOREIGN KEY ("participantId", "clubId")
    REFERENCES "SessionParticipant" (id, "clubId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SessionInvite_inviterMembershipId_clubId_fkey" FOREIGN KEY ("inviterMembershipId", "clubId")
    REFERENCES "Membership" (id, "clubId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "SessionInvite_digest_check" CHECK ("tokenDigest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "SessionInvite_expiry_check" CHECK ("expiresAt" > "createdAt"),
  CONSTRAINT "SessionInvite_response_check" CHECK (
    ("respondedAt" IS NULL AND accepted IS NULL)
    OR ("respondedAt" IS NOT NULL AND accepted IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "SessionInvite_tokenDigest_key" ON "SessionInvite" ("tokenDigest");
CREATE INDEX "SessionInvite_participantId_createdAt_idx" ON "SessionInvite" ("participantId", "createdAt");
CREATE INDEX "SessionInvite_inviterMembershipId_idx" ON "SessionInvite" ("inviterMembershipId");

-- A roster write and a phase decision use the same parent lock. Version changes roll
-- back with the participant write, and attendance-only edits leave the denominator unchanged.
CREATE FUNCTION update_session_roster_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW."sessionId", NEW."membershipId", NEW."clubId") IS DISTINCT FROM
       (OLD."sessionId", OLD."membershipId", OLD."clubId") THEN
      RAISE EXCEPTION 'SessionParticipant identity is immutable' USING ERRCODE = '23514';
    END IF;
    IF NEW.status = OLD.status THEN RETURN NEW; END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN
    UPDATE "Session" SET "rosterVersion" = "rosterVersion" + 1 WHERE id = OLD."sessionId";
    RETURN OLD;
  END IF;
  UPDATE "Session" SET "rosterVersion" = "rosterVersion" + 1 WHERE id = NEW."sessionId";
  RETURN NEW;
END;
$$;
CREATE TRIGGER "SessionParticipant_roster_version"
  BEFORE INSERT OR UPDATE OR DELETE ON "SessionParticipant"
  FOR EACH ROW EXECUTE FUNCTION update_session_roster_version();

COMMIT;
