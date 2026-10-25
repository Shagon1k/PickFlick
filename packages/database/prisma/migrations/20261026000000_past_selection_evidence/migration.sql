BEGIN;

CREATE TABLE "PastNomination" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "sessionId" UUID NOT NULL REFERENCES "Session"(id) ON DELETE RESTRICT,
    "movieId" UUID NOT NULL REFERENCES "Movie"(id) ON DELETE RESTRICT,
    UNIQUE ("sessionId", "movieId"),
    UNIQUE (id, "sessionId")
);

CREATE TABLE "PastSelectionScore" (
    "nominationId" UUID NOT NULL,
    "participantId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    score INTEGER NOT NULL,
    PRIMARY KEY ("nominationId", "participantId"),
    FOREIGN KEY ("nominationId", "sessionId") REFERENCES "PastNomination"(id, "sessionId") ON DELETE RESTRICT,
    FOREIGN KEY ("participantId", "sessionId") REFERENCES "SessionParticipant"(id, "sessionId") ON DELETE RESTRICT
);
CREATE INDEX "PastSelectionScore_participantId_idx" ON "PastSelectionScore"("participantId");

CREATE FUNCTION protect_past_selection_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE saved_session "Session";
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Imported Selection evidence is immutable';
    END IF;
    SELECT * INTO saved_session FROM "Session" WHERE id = NEW."sessionId" FOR UPDATE;
    IF saved_session.type IS DISTINCT FROM 'PAST'::"SessionType" OR
       saved_session.phase IS DISTINCT FROM 'COMPLETED'::"SessionPhase" THEN
        RAISE EXCEPTION 'Imported Selection evidence requires a Completed past Session';
    END IF;
    IF TG_TABLE_NAME = 'PastSelectionScore' THEN
        IF NEW.score < saved_session."selectionScaleMin" OR NEW.score > saved_session."selectionScaleMax" THEN
            RAISE EXCEPTION 'Imported score is outside the Session scale';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "PastNomination_protect" BEFORE INSERT OR UPDATE ON "PastNomination"
FOR EACH ROW EXECUTE FUNCTION protect_past_selection_evidence();
CREATE TRIGGER "PastSelectionScore_protect" BEFORE INSERT OR UPDATE ON "PastSelectionScore"
FOR EACH ROW EXECUTE FUNCTION protect_past_selection_evidence();

COMMIT;
