BEGIN;

-- Nomination and Session summaries read title and year from the Movie row instead of
-- searching three cache tables.
ALTER TABLE "Movie" ADD COLUMN "title" TEXT, ADD COLUMN "releaseYear" INTEGER;

UPDATE "Movie" m
SET "title" = COALESCE(latest.data->>'title', latest.data->>'originalTitle'),
    "releaseYear" = (latest.data->>'releaseYear')::integer
FROM (
    SELECT DISTINCT ON ("movieId") "movieId", data
    FROM "MovieDetailsCache"
    ORDER BY "movieId", "fetchedAt" DESC
) latest
WHERE latest."movieId" = m.id;

UPDATE "Movie" m
SET "title" = COALESCE(latest.data->'data'->>'title', latest.data->'data'->>'originalTitle'),
    "releaseYear" = (latest.data->'data'->>'releaseYear')::integer
FROM (
    SELECT DISTINCT ON ("movieId") "movieId", data
    FROM "MovieSourceCache"
    ORDER BY "movieId", "fetchedAt" DESC
) latest
WHERE latest."movieId" = m.id AND m."title" IS NULL;

-- Per-source snapshots and removal tombstones are gone; the merged projection is the cache.
-- Cache keys no longer hash adapter configuration, so existing projections are refilled.
DROP TABLE "MovieSourceCache";
ALTER TABLE "MovieExternalId" DROP COLUMN "unavailableAt";
DELETE FROM "MovieDetailsCache";
DELETE FROM "MovieSearchCache";

COMMIT;
