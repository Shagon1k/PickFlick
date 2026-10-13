BEGIN;
DROP TRIGGER "SessionParticipant_roster_version" ON "SessionParticipant";
DROP FUNCTION update_session_roster_version();
ALTER TABLE "Session" DROP CONSTRAINT "Session_versions_check";
ALTER TABLE "Session" DROP COLUMN "rosterVersion";
ALTER TABLE "Session" ADD CONSTRAINT "Session_versions_check" CHECK ("phaseVersion" > 0);
ALTER TABLE "SessionProgressEvent" DROP COLUMN "rosterVersion";

-- Keep the identity invariant formerly bundled with roster versioning.
CREATE FUNCTION preserve_session_participant_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW."sessionId", NEW."membershipId", NEW."clubId") IS DISTINCT FROM
     (OLD."sessionId", OLD."membershipId", OLD."clubId") THEN
    RAISE EXCEPTION 'SessionParticipant identity is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "SessionParticipant_identity"
  BEFORE UPDATE ON "SessionParticipant"
  FOR EACH ROW EXECUTE FUNCTION preserve_session_participant_identity();
COMMIT;
