BEGIN;

ALTER TYPE "ClubAuditAction" ADD VALUE 'SESSION_SELECTION_CLOSED';
ALTER TABLE "Session" ADD COLUMN "selectionResult" JSONB;

CREATE FUNCTION preserve_selection_result() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."selectionResult" IS NOT NULL AND (
    NEW."selectionResult" IS DISTINCT FROM OLD."selectionResult" OR
    NEW."movieId" IS DISTINCT FROM OLD."movieId"
  ) THEN
    RAISE EXCEPTION 'Selection result and winner are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "Session_preserve_selection_result"
BEFORE UPDATE OF "selectionResult", "movieId" ON "Session"
FOR EACH ROW EXECUTE FUNCTION preserve_selection_result();

COMMIT;
