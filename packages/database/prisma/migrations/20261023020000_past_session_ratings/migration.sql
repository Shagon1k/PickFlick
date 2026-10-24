BEGIN;

-- PAST is the provenance for operator-entered history. No submission time is invented.
ALTER TABLE "SessionRating" ALTER COLUMN "submittedAt" DROP NOT NULL;

CREATE OR REPLACE FUNCTION protect_session_rating() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_phase "SessionPhase";
DECLARE session_type "SessionType";
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Session Ratings are immutable';
    END IF;
    SELECT phase, type INTO current_phase, session_type
        FROM "Session" WHERE id = NEW."sessionId" FOR UPDATE;
    IF session_type = 'PAST' THEN
        IF current_phase IS DISTINCT FROM 'COMPLETED'::"SessionPhase" OR NEW."submittedAt" IS NOT NULL THEN
            RAISE EXCEPTION 'Imported ratings require a Completed past Session and no submission time';
        END IF;
    ELSIF current_phase IS DISTINCT FROM 'RATING'::"SessionPhase" OR NEW."submittedAt" IS NULL THEN
        RAISE EXCEPTION 'Live ratings require an open Rating Session and a submission time';
    END IF;
    RETURN NEW;
END;
$$;

COMMIT;
