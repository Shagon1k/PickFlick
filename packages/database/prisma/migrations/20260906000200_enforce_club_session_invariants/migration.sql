-- Backward compatible with the initial application schema: this migration adds constraints and
-- indexes over existing columns. Existing rows must already satisfy these rules.
ALTER TABLE "Club" ADD CONSTRAINT "Club_selection_scale_check"
  CHECK ("selectionScaleMin" IN (0, 1)
    AND "selectionScaleMax" BETWEEN 1 AND 10
    AND "selectionScaleMax" > "selectionScaleMin");

ALTER TABLE "Session" ADD CONSTRAINT "Session_phase_version_check"
  CHECK ("phaseVersion" > 0);

CREATE UNIQUE INDEX "Membership_one_active_admin_per_club_key"
  ON "Membership" ("clubId")
  WHERE "role" = 'ADMIN' AND "status" = 'ACTIVE';

CREATE UNIQUE INDEX "Session_one_blocking_per_club_key"
  ON "Session" ("clubId")
  WHERE "phase" IN ('NOMINATION', 'SELECTION', 'WATCHING');
