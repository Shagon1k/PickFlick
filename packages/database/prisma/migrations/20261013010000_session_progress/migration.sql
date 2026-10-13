BEGIN;

ALTER TABLE "Session" ADD COLUMN "progressVersion" INTEGER NOT NULL DEFAULT 1,
  ADD CONSTRAINT "Session_progress_version_check" CHECK ("progressVersion" > 0);

CREATE TABLE "SessionProgressEvent" (
  "sessionId" UUID NOT NULL REFERENCES "Session"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  version INTEGER NOT NULL,
  kind VARCHAR(20) NOT NULL,
  phase "SessionPhase" NOT NULL,
  "phaseVersion" INTEGER NOT NULL,
  "rosterVersion" INTEGER NOT NULL,
  "detailsVersion" INTEGER NOT NULL,
  "acceptedCount" INTEGER NOT NULL,
  "nominatedCount" INTEGER NOT NULL,
  "recipientIds" UUID[] NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("sessionId", version),
  CONSTRAINT "SessionProgressEvent_counts_check" CHECK (
    "nominatedCount" >= 0 AND "acceptedCount" >= "nominatedCount" AND version > 0
  ),
  CONSTRAINT "SessionProgressEvent_kind_check" CHECK (
    kind IN ('PROGRESS', 'AUTOMATIC', 'MANUAL', 'DEADLINE', 'DETAILS', 'CANCELLED')
  )
);

COMMIT;
