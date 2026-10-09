CREATE TABLE "Movie" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tmdbId" INTEGER NOT NULL,
    "summary" JSONB,
    "summaryFetchedAt" TIMESTAMPTZ(3),
    "details" JSONB,
    "detailsFetchedAt" TIMESTAMPTZ(3),
    "unavailableAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Movie_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Movie_tmdbId_positive" CHECK ("tmdbId" > 0),
    CONSTRAINT "Movie_summary_completeness" CHECK
        (("summary" IS NULL) = ("summaryFetchedAt" IS NULL)),
    CONSTRAINT "Movie_detail_completeness" CHECK
        (("details" IS NULL) = ("detailsFetchedAt" IS NULL))
);
CREATE UNIQUE INDEX "Movie_tmdbId_key" ON "Movie"("tmdbId");
CREATE INDEX "Movie_detailsFetchedAt_idx" ON "Movie"("detailsFetchedAt");

CREATE TABLE "MovieSearchCache" (
    "key" CHAR(64) NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "MovieSearchCache_pkey" PRIMARY KEY ("key")
);
