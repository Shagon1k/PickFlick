import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { loadDatabaseEnvironment } from '@pickflick/config/environment';
import { Pool, type PoolClient } from 'pg';

import { assertSafeSeedOrResetTarget } from '../safety.js';

// The catalog tables as migration 21 finds them; nothing else in the schema affects it.
const CATALOG_TABLES = `
    CREATE TABLE "Movie" ("id" UUID PRIMARY KEY, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT now());
    CREATE TABLE "MovieExternalId" (
        "movieId" UUID NOT NULL REFERENCES "Movie"("id"), "source" VARCHAR(20) NOT NULL,
        "externalId" VARCHAR(32) NOT NULL, "unavailableAt" TIMESTAMPTZ(3),
        PRIMARY KEY ("source", "externalId"));
    CREATE TABLE "MovieSourceCache" (
        "movieId" UUID NOT NULL REFERENCES "Movie"("id"), "source" VARCHAR(20) NOT NULL,
        "locale" VARCHAR(20) NOT NULL, "data" JSONB NOT NULL, "fetchedAt" TIMESTAMPTZ(3) NOT NULL,
        PRIMARY KEY ("movieId", "source", "locale"));
    CREATE TABLE "MovieDetailsCache" (
        "movieId" UUID NOT NULL REFERENCES "Movie"("id"), "key" CHAR(64) NOT NULL,
        "data" JSONB NOT NULL, "fetchedAt" TIMESTAMPTZ(3) NOT NULL, PRIMARY KEY ("movieId", "key"));
    CREATE TABLE "MovieSearchCache" (
        "key" CHAR(64) PRIMARY KEY, "data" JSONB NOT NULL, "fetchedAt" TIMESTAMPTZ(3) NOT NULL);
`;

async function readMigration(): Promise<string> {
    const sql = await readFile(
        new URL(
            '../../prisma/migrations/20261013030000_simplify_movie_cache/migration.sql',
            import.meta.url,
        ),
        'utf8',
    );
    // The test owns the transaction so it can roll the throwaway schema back.
    return sql.replaceAll(/^(BEGIN|COMMIT);$/gmu, '');
}

function searchHit(id: string, title: string | null, originalTitle: string, releaseYear: number) {
    return { id, title, originalTitle, releaseYear };
}

describe('Movie cache simplification migration', () => {
    let pool: Pool;
    let client: PoolClient;

    beforeEach(async () => {
        const environment = loadDatabaseEnvironment();
        assertSafeSeedOrResetTarget(environment);
        pool = new Pool({ connectionString: environment.databaseUrl });
        client = await pool.connect();
        const schema = `movie_cache_${randomUUID().replaceAll('-', '')}`;
        await client.query('BEGIN');
        await client.query(`CREATE SCHEMA "${schema}"`);
        await client.query(`SET LOCAL search_path TO "${schema}"`);
        await client.query(CATALOG_TABLES);
    });

    afterEach(async () => {
        await client.query('ROLLBACK');
        client.release();
        await pool.end();
    });

    it('should name every Movie from its details, its source snapshot, or its newest search hit', async () => {
        const [fromDetails, fromSource, fromSearch, untitled, unknown] = [
            randomUUID(),
            randomUUID(),
            randomUUID(),
            randomUUID(),
            randomUUID(),
        ];
        for (const id of [fromDetails, fromSource, fromSearch, untitled, unknown]) {
            await client.query('INSERT INTO "Movie" ("id") VALUES ($1)', [id]);
        }
        const older = new Date('2026-10-01T00:00:00Z');
        const newer = new Date('2026-10-02T00:00:00Z');
        await client.query('INSERT INTO "MovieDetailsCache" VALUES ($1, $2, $3, $4)', [
            fromDetails,
            'd'.repeat(64),
            { title: 'Details Title', releaseYear: 1955 },
            newer,
        ]);
        await client.query('INSERT INTO "MovieSourceCache" VALUES ($1, $2, $3, $4, $5)', [
            fromSource,
            'tmdb',
            'en-US',
            { data: { title: 'Source Title', releaseYear: 1962 } },
            newer,
        ]);
        await client.query('INSERT INTO "MovieSearchCache" VALUES ($1, $2, $3), ($4, $5, $6)', [
            'a'.repeat(64),
            { movies: [searchHit(fromSearch, 'Stale Title', 'Stale', 1940)] },
            older,
            'b'.repeat(64),
            {
                movies: [
                    searchHit(fromSearch, 'Search Title', 'Original', 1941),
                    searchHit(untitled, null, 'Original Only', 1999),
                    // Details already named this Movie; a search hit must not overwrite them.
                    searchHit(fromDetails, 'Search Rename', 'Rename', 2000),
                ],
            },
            newer,
        ]);

        await client.query(await readMigration());

        const rows = await client.query<{
            id: string;
            title: string | null;
            releaseYear: number | null;
        }>('SELECT "id", "title", "releaseYear" FROM "Movie"');
        expect(
            Object.fromEntries(rows.rows.map((row) => [row.id, [row.title, row.releaseYear]])),
        ).toEqual({
            [fromDetails]: ['Details Title', 1955],
            [fromSource]: ['Source Title', 1962],
            [fromSearch]: ['Search Title', 1941],
            [untitled]: ['Original Only', 1999],
            [unknown]: [null, null],
        });
        expect((await client.query('SELECT * FROM "MovieSearchCache"')).rowCount).toBe(0);
    });
});
