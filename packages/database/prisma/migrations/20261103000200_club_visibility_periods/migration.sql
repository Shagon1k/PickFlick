ALTER TABLE "Club"
  ADD COLUMN "showNominationAuthorsDuring" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showNominationAuthorsAfter" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "showSelectionScoresDuring" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "showSelectionScoresAfter" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "showRatingsDuring" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "showRatingsAfter" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Club" SET
  "showNominationAuthorsDuring" = "showNominationAuthors",
  "showNominationAuthorsAfter" = "showNominationAuthors",
  "showSelectionScoresAfter" = "showVoteResults",
  "showRatingsAfter" = "showRatingResults";

-- Existing Session snapshots retain their original disclosure rules. Only newly created
-- Sessions receive a complete period-specific snapshot from the Club.
ALTER TABLE "Session"
  ADD COLUMN "showNominationAuthorsDuring" BOOLEAN,
  ADD COLUMN "showNominationAuthorsAfter" BOOLEAN,
  ADD COLUMN "showSelectionScoresDuring" BOOLEAN,
  ADD COLUMN "showSelectionScoresAfter" BOOLEAN,
  ADD COLUMN "showRatingsDuring" BOOLEAN,
  ADD COLUMN "showRatingsAfter" BOOLEAN,
  ADD CONSTRAINT "Session_visibility_periods_complete" CHECK (
    num_nonnulls(
      "showNominationAuthorsDuring", "showNominationAuthorsAfter",
      "showSelectionScoresDuring", "showSelectionScoresAfter",
      "showRatingsDuring", "showRatingsAfter"
    ) IN (0, 6)
  );
