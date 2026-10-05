ALTER TYPE "ClubAuditAction" ADD VALUE 'CLUB_INVITE_CREATED';
ALTER TYPE "ClubAuditAction" ADD VALUE 'CLUB_INVITE_REVOKED';
ALTER TYPE "ClubAuditAction" ADD VALUE 'MEMBERSHIP_JOINED';

CREATE TABLE "ClubInvite" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tokenDigest" CHAR(64) NOT NULL,
    "clubId" UUID NOT NULL REFERENCES "Club"("id") ON DELETE RESTRICT,
    "inviterId" UUID NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT,
    "targetUserId" UUID REFERENCES "User"("id") ON DELETE RESTRICT,
    "responderId" UUID REFERENCES "User"("id") ON DELETE RESTRICT,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),
    "respondedAt" TIMESTAMPTZ(3),
    "accepted" BOOLEAN,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id"),
    CONSTRAINT "ClubInvite_digest" CHECK ("tokenDigest" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "ClubInvite_expiry" CHECK ("expiresAt" > "createdAt"),
    CONSTRAINT "ClubInvite_response" CHECK (
        ("respondedAt" IS NULL AND "responderId" IS NULL AND "accepted" IS NULL) OR
        ("respondedAt" IS NOT NULL AND "responderId" IS NOT NULL AND "accepted" IS NOT NULL)
    )
);
CREATE UNIQUE INDEX "ClubInvite_tokenDigest_key" ON "ClubInvite"("tokenDigest");
CREATE INDEX "ClubInvite_clubId_createdAt_idx" ON "ClubInvite"("clubId", "createdAt");
