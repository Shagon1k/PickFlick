BEGIN;

ALTER TYPE "ClubAuditAction" ADD VALUE 'SESSION_RATING_CLOSED';

CREATE TABLE "SessionRating" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sessionId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "score" INTEGER NOT NULL CHECK ("score" BETWEEN 1 AND 10),
    "comment" TEXT CHECK (char_length("comment") <= 2000),
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessionRating_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SessionRating_sessionId_fkey" FOREIGN KEY ("sessionId")
        REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SessionRating_participantId_sessionId_fkey" FOREIGN KEY ("participantId", "sessionId")
        REFERENCES "SessionParticipant"("id", "sessionId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "SessionRating_participantId_sessionId_key" ON "SessionRating"("participantId", "sessionId");
CREATE INDEX "SessionRating_sessionId_idx" ON "SessionRating"("sessionId");

CREATE FUNCTION protect_session_rating() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_phase "SessionPhase";
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Session Ratings are immutable';
    END IF;
    -- Serialize inserts with completion, including callers outside the API.
    SELECT phase INTO current_phase FROM "Session" WHERE id = NEW."sessionId" FOR UPDATE;
    IF current_phase IS DISTINCT FROM 'RATING'::"SessionPhase" THEN
        RAISE EXCEPTION 'Session is not accepting ratings';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER "SessionRating_protect" BEFORE INSERT OR UPDATE ON "SessionRating"
FOR EACH ROW EXECUTE FUNCTION protect_session_rating();

COMMIT;
