CREATE TYPE "AppRole" AS ENUM ('USER', 'APP_ADMIN');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ANONYMIZED');
CREATE TYPE "ClubLifecycle" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "ClubRole" AS ENUM ('ADMIN', 'MODERATOR', 'MEMBER');
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'LEFT', 'REMOVED');
CREATE TYPE "SessionType" AS ENUM ('FULL_CYCLE', 'PRE_SELECTED', 'PAST');
CREATE TYPE "SessionPhase" AS ENUM ('NOMINATION', 'SELECTION', 'WATCHING', 'RATING', 'COMPLETED', 'CANCELLED');

CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "appRole" "AppRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Club" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "lifecycle" "ClubLifecycle" NOT NULL DEFAULT 'ACTIVE',
    "selectionScaleMin" INTEGER NOT NULL DEFAULT 1,
    "selectionScaleMax" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Club_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Membership" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "ClubRole" NOT NULL DEFAULT 'MEMBER',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMPTZ(3),
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id" UUID NOT NULL,
    "clubId" UUID NOT NULL,
    "type" "SessionType" NOT NULL,
    "phase" "SessionPhase" NOT NULL,
    "scheduledAt" TIMESTAMPTZ(3),
    "location" TEXT,
    "topic" TEXT,
    "notes" TEXT,
    "deadlineAt" TIMESTAMPTZ(3),
    "phaseVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Membership_clubId_userId_key" ON "Membership"("clubId", "userId");
CREATE INDEX "Membership_userId_status_idx" ON "Membership"("userId", "status");
CREATE INDEX "Session_clubId_phase_idx" ON "Session"("clubId", "phase");

ALTER TABLE "Membership" ADD CONSTRAINT "Membership_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Session" ADD CONSTRAINT "Session_clubId_fkey"
  FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
