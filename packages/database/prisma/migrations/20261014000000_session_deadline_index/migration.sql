-- The deadline worker polls Nomination Sessions whose deadline has passed.
CREATE INDEX "Session_phase_deadlineAt_idx" ON "Session"("phase", "deadlineAt");
