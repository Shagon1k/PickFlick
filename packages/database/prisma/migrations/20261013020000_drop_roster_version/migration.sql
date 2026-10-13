BEGIN;

-- Roster changes are observed through Session progress versions. Keep only the guard that a
-- participant row never moves to another Session, Membership, or Club.
DROP TRIGGER "SessionParticipant_roster_version" ON "SessionParticipant";
DROP FUNCTION update_session_roster_version();

CREATE FUNCTION reject_session_participant_identity_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."sessionId", NEW."membershipId", NEW."clubId") IS DISTINCT FROM
     (OLD."sessionId", OLD."membershipId", OLD."clubId") THEN
    RAISE EXCEPTION 'SessionParticipant identity is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "SessionParticipant_identity_immutable"
  BEFORE UPDATE ON "SessionParticipant"
  FOR EACH ROW EXECUTE FUNCTION reject_session_participant_identity_change();

ALTER TABLE "Session" DROP CONSTRAINT "Session_versions_check",
  DROP COLUMN "rosterVersion",
  ADD CONSTRAINT "Session_versions_check" CHECK ("phaseVersion" > 0);

ALTER TABLE "SessionProgressEvent" DROP COLUMN "rosterVersion";

COMMIT;
