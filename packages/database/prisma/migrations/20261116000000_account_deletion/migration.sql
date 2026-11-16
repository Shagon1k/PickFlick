ALTER TYPE "ClubAuditAction" ADD VALUE 'ACCOUNT_DELETED';
ALTER TYPE "NotificationEvent" ADD VALUE 'CLUB_ADMIN_DELETED';
CREATE TYPE "AccountDeletionStatus" AS ENUM ('AWAITING_REAUTH', 'PENDING', 'COMPLETE');
CREATE TABLE "AccountDeletion" (
    "userId" UUID PRIMARY KEY REFERENCES "User"("id") ON DELETE RESTRICT,
    "status" "AccountDeletionStatus" NOT NULL DEFAULT 'AWAITING_REAUTH',
    "sessionId" UUID,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "nextAttemptAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "failure" TEXT,
    "avatarKey" TEXT,
    "billing" TEXT NOT NULL DEFAULT 'NOT_IMPLEMENTED'
);
CREATE INDEX "AccountDeletion_status_nextAttemptAt_idx" ON "AccountDeletion"("status", "nextAttemptAt");

-- Requests and workers that passed authentication before deletion may still be in flight.
-- Share-locking the owner serializes their private writes with the deletion transaction.
CREATE FUNCTION reject_deleted_account_write() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id UUID; owner_status "UserStatus";
BEGIN
    owner_id := (to_jsonb(NEW) ->> TG_ARGV[0])::uuid;
    IF owner_id IS NULL THEN RETURN NEW; END IF;
    SELECT status INTO owner_status FROM "User" WHERE id = owner_id FOR SHARE;
    IF owner_status = 'ANONYMIZED' THEN
        RAISE EXCEPTION 'Account unavailable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER personal_rating_active_owner BEFORE INSERT OR UPDATE ON "PersonalMovieRating"
    FOR EACH ROW EXECUTE FUNCTION reject_deleted_account_write('userId');
CREATE TRIGGER watchlist_active_owner BEFORE INSERT OR UPDATE ON "WatchlistItem"
    FOR EACH ROW EXECUTE FUNCTION reject_deleted_account_write('userId');
CREATE TRIGGER auth_session_active_owner BEFORE INSERT OR UPDATE ON "AuthSession"
    FOR EACH ROW EXECUTE FUNCTION reject_deleted_account_write('userId');
CREATE TRIGGER provider_account_active_owner BEFORE INSERT OR UPDATE ON "ProviderAccount"
    FOR EACH ROW EXECUTE FUNCTION reject_deleted_account_write('userId');
CREATE TRIGGER personal_award_active_owner BEFORE INSERT OR UPDATE ON "AchievementAward"
    FOR EACH ROW EXECUTE FUNCTION reject_deleted_account_write('userId');
CREATE TRIGGER notification_active_owner BEFORE INSERT OR UPDATE ON "Notification"
    FOR EACH ROW EXECUTE FUNCTION reject_deleted_account_write('recipientId');
CREATE TRIGGER notification_preference_active_owner BEFORE INSERT OR UPDATE ON "NotificationPreference"
    FOR EACH ROW EXECUTE FUNCTION reject_deleted_account_write('userId');
CREATE TRIGGER membership_active_owner BEFORE INSERT OR UPDATE ON "Membership"
    FOR EACH ROW WHEN (NEW.status = 'ACTIVE')
    EXECUTE FUNCTION reject_deleted_account_write('userId');

-- A late provider callback must not repopulate a profile after accepted deletion.
CREATE FUNCTION preserve_deleted_account_profile() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status = 'ANONYMIZED' AND EXISTS (
        SELECT 1 FROM "AccountDeletion" WHERE "userId" = OLD.id AND status <> 'AWAITING_REAUTH'
    ) THEN
        RAISE EXCEPTION 'Account unavailable' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER deleted_account_profile BEFORE UPDATE ON "User"
    FOR EACH ROW EXECUTE FUNCTION preserve_deleted_account_profile();
