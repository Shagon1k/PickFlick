-- New Clubs start their Selection scale at 0; Clubs that stored 1 keep it.
ALTER TABLE "Club" ALTER COLUMN "selectionScaleMin" SET DEFAULT 0;
