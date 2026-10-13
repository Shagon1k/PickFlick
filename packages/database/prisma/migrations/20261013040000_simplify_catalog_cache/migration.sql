BEGIN;
ALTER TABLE "Movie" ADD COLUMN title TEXT, ADD COLUMN "releaseYear" INTEGER;
-- Preserve available summary metadata; prefer details, then source and search caches.
WITH metadata AS (
  SELECT "movieId", data, 1 AS priority, "fetchedAt" FROM "MovieDetailsCache"
  UNION ALL
  SELECT "movieId", data->'data', 2, "fetchedAt" FROM "MovieSourceCache"
  UNION ALL
  SELECT (movie->>'id')::uuid, movie, 3, "fetchedAt"
  FROM "MovieSearchCache", jsonb_array_elements(data->'movies') AS movie
), latest AS (
  SELECT DISTINCT ON ("movieId") "movieId", data FROM metadata
  ORDER BY "movieId", priority, "fetchedAt" DESC
)
UPDATE "Movie" m SET title = COALESCE(latest.data->>'title', latest.data->>'originalTitle'),
  "releaseYear" = (latest.data->>'releaseYear')::integer FROM latest WHERE m.id = latest."movieId";
UPDATE "MovieDetailsCache" c SET "fetchedAt" = LEAST(c."fetchedAt", p.oldest)
FROM (
  SELECT "movieId", key, MIN((source->>'fetchedAt')::timestamptz) AS oldest
  FROM "MovieDetailsCache", jsonb_array_elements(data->'provenance') AS source GROUP BY "movieId", key
) p WHERE c."movieId" = p."movieId" AND c.key = p.key;
ALTER TABLE "MovieExternalId" DROP COLUMN "unavailableAt";
COMMIT;
