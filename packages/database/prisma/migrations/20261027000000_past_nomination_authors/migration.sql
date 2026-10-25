BEGIN;

-- Existing evidence keeps a null author; no historical attribution is inferred.
ALTER TABLE "PastNomination" ADD COLUMN "nominatorMembershipId" UUID;
ALTER TABLE "PastNomination" ADD CONSTRAINT "PastNomination_nominatorMembershipId_fkey"
    FOREIGN KEY ("nominatorMembershipId") REFERENCES "Membership"(id)
    ON DELETE RESTRICT ON UPDATE RESTRICT;

CREATE FUNCTION enforce_past_nominator_club() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE membership_club UUID;
session_club UUID;
BEGIN
    IF TG_TABLE_NAME = 'PastNomination' THEN
        IF NEW."nominatorMembershipId" IS NULL THEN RETURN NEW; END IF;
        SELECT "clubId" INTO session_club FROM "Session" WHERE id = NEW."sessionId" FOR UPDATE;
        SELECT "clubId" INTO membership_club FROM "Membership"
            WHERE id = NEW."nominatorMembershipId" FOR SHARE;
        IF membership_club IS DISTINCT FROM session_club THEN
            RAISE EXCEPTION 'Imported nominator must belong to the same Club';
        END IF;
    ELSIF TG_TABLE_NAME = 'Membership' THEN
        IF EXISTS (
            SELECT 1 FROM "PastNomination" n JOIN "Session" s ON s.id = n."sessionId"
            WHERE n."nominatorMembershipId" = NEW.id AND s."clubId" <> NEW."clubId"
        ) THEN RAISE EXCEPTION 'Imported nominator must belong to the same Club'; END IF;
    ELSE
        IF EXISTS (
            SELECT 1 FROM "PastNomination" n JOIN "Membership" m ON m.id = n."nominatorMembershipId"
            WHERE n."sessionId" = NEW.id AND m."clubId" <> NEW."clubId"
        ) THEN RAISE EXCEPTION 'Imported nominator must belong to the same Club'; END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- The existing evidence trigger still rejects every UPDATE, including author edits.
CREATE TRIGGER "PastNomination_nominator_club" BEFORE INSERT ON "PastNomination"
FOR EACH ROW EXECUTE FUNCTION enforce_past_nominator_club();
CREATE TRIGGER "Membership_past_nominator_club" BEFORE UPDATE OF "clubId" ON "Membership"
FOR EACH ROW EXECUTE FUNCTION enforce_past_nominator_club();
CREATE TRIGGER "Session_past_nominator_club" BEFORE UPDATE OF "clubId" ON "Session"
FOR EACH ROW EXECUTE FUNCTION enforce_past_nominator_club();

COMMIT;
