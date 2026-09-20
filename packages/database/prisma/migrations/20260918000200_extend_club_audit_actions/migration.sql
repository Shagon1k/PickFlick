-- PostgreSQL requires enum values to commit before a later transaction may reference them.
BEGIN;

ALTER TYPE "ClubAuditAction" ADD VALUE 'CLUB_SETTINGS_UPDATED';
ALTER TYPE "ClubAuditAction" ADD VALUE 'CLUB_AVATAR_UPDATED';
ALTER TYPE "ClubAuditAction" ADD VALUE 'CLUB_ARCHIVED';
ALTER TYPE "ClubAuditAction" ADD VALUE 'CLUB_REACTIVATED';
ALTER TYPE "ClubAuditAction" ADD VALUE 'MEMBERSHIP_LEFT';
ALTER TYPE "ClubAuditAction" ADD VALUE 'CLUB_DELETED';

COMMIT;
