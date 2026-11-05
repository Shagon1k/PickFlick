-- Club visibility applies to every Session on each read, so Session copies of the flags were never
-- read. The legacy single Club flags were replaced by period-specific ones in 20261103000200.
ALTER TABLE "Session"
  DROP CONSTRAINT "Session_visibility_periods_complete",
  DROP COLUMN "showNominationAuthors",
  DROP COLUMN "showNominationsBeforeSubmit",
  DROP COLUMN "showVoteResults",
  DROP COLUMN "showRatingResults",
  DROP COLUMN "showNominationAuthorsDuring",
  DROP COLUMN "showNominationAuthorsAfter",
  DROP COLUMN "showSelectionScoresDuring",
  DROP COLUMN "showSelectionScoresAfter",
  DROP COLUMN "showRatingsDuring",
  DROP COLUMN "showRatingsAfter",
  DROP COLUMN "useMonochromeMedia";

ALTER TABLE "Club"
  DROP COLUMN "showNominationAuthors",
  DROP COLUMN "showVoteResults",
  DROP COLUMN "showRatingResults",
  DROP COLUMN "useMonochromeMedia";
