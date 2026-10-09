-- Preserve every existing UUID, including tombstones, before removing TMDB identity.
CREATE TABLE "MovieExternalId" (
    "movieId" UUID NOT NULL REFERENCES "Movie"("id") ON DELETE CASCADE,
    "source" VARCHAR(20) NOT NULL,
    "externalId" VARCHAR(32) NOT NULL,
    "unavailableAt" TIMESTAMPTZ(3),
    PRIMARY KEY ("source", "externalId"),
    CONSTRAINT "MovieExternalId_source" CHECK ("source" IN ('tmdb','poiskkino','thetvdb','imdb')),
    CONSTRAINT "MovieExternalId_format" CHECK (
        ("source" = 'imdb' AND "externalId" ~ '^tt[0-9]{7,12}$') OR
        ("source" <> 'imdb' AND "externalId" ~ '^[1-9][0-9]{0,15}$'))
);
CREATE UNIQUE INDEX "MovieExternalId_movieId_source_key" ON "MovieExternalId"("movieId", "source");
INSERT INTO "MovieExternalId" ("movieId", "source", "externalId", "unavailableAt")
    SELECT "id", 'tmdb', "tmdbId"::text, "unavailableAt" FROM "Movie";
-- Preserve validated legacy IMDb links. Conflicting legacy links fail migration and require
-- reviewed reconciliation; never discard an existing correspondence silently.
INSERT INTO "MovieExternalId" ("movieId", "source", "externalId")
    SELECT "id", 'imdb', "details"->>'imdbId' FROM "Movie"
    WHERE "details"->>'imdbId' ~ '^tt[0-9]{7,12}$';
CREATE TABLE "MovieSourceCache" (
    "movieId" UUID NOT NULL REFERENCES "Movie"("id") ON DELETE CASCADE,
    "source" VARCHAR(20) NOT NULL CHECK ("source" IN ('tmdb','poiskkino','thetvdb')),
    "locale" VARCHAR(20) NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL,
    PRIMARY KEY ("movieId", "source", "locale")
);
CREATE TABLE "MovieDetailsCache" (
    "movieId" UUID NOT NULL REFERENCES "Movie"("id") ON DELETE CASCADE,
    "key" CHAR(64) NOT NULL,
    "data" JSONB NOT NULL,
    "fetchedAt" TIMESTAMPTZ(3) NOT NULL,
    PRIMARY KEY ("movieId", "key")
);
-- Legacy TMDB JSON is a cache, not domain identity; refill under the new contract.
DELETE FROM "MovieSearchCache";
ALTER TABLE "Movie" DROP COLUMN "tmdbId", DROP COLUMN "summary", DROP COLUMN "summaryFetchedAt",
    DROP COLUMN "details", DROP COLUMN "detailsFetchedAt", DROP COLUMN "unavailableAt";
