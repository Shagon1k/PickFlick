import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { loadDatabaseEnvironment } from '@pickflick/config/environment';
import { Pool } from 'pg';

import { assertSafeSeedOrResetTarget } from '../safety.js';

describe('Movie source migration', () => {
    it('should retain legacy UUIDs, TMDB/IMDb mappings and removal observations', async () => {
        const environment = loadDatabaseEnvironment();
        assertSafeSeedOrResetTarget(environment);
        const pool = new Pool({ connectionString: environment.databaseUrl });
        const client = await pool.connect();
        const schema = `catalog_migration_${randomUUID().replaceAll('-', '')}`;
        const id = randomUUID();
        const removedId = randomUUID();
        const at = new Date('2026-10-09T12:00:00Z');
        try {
            await client.query('BEGIN');
            await client.query(`CREATE SCHEMA "${schema}"`);
            await client.query(`SET LOCAL search_path TO "${schema}"`);
            await client.query(
                await readFile(
                    new URL(
                        '../../prisma/migrations/20261009000000_movie_catalog/migration.sql',
                        import.meta.url,
                    ),
                    'utf8',
                ),
            );
            await client.query(
                'INSERT INTO "Movie" ("id","tmdbId","details","detailsFetchedAt") VALUES ($1,100,$2,$3)',
                [id, JSON.stringify({ imdbId: 'tt0000100' }), at],
            );
            await client.query(
                'INSERT INTO "Movie" ("id","tmdbId","unavailableAt") VALUES ($1,101,$2)',
                [removedId, at],
            );
            await client.query(
                await readFile(
                    new URL(
                        '../../prisma/migrations/20261009200000_movie_sources/migration.sql',
                        import.meta.url,
                    ),
                    'utf8',
                ),
            );
            const rows = await client.query<{
                movieId: string;
                source: string;
                externalId: string;
                unavailableAt: Date | null;
            }>('SELECT * FROM "MovieExternalId"');
            expect(rows.rows).toEqual(
                expect.arrayContaining([
                    { movieId: id, source: 'tmdb', externalId: '100', unavailableAt: null },
                    { movieId: id, source: 'imdb', externalId: 'tt0000100', unavailableAt: null },
                    { movieId: removedId, source: 'tmdb', externalId: '101', unavailableAt: at },
                ]),
            );
            expect(
                (await client.query<{ id: string }>('SELECT "id" FROM "Movie"')).rows
                    .map((row) => row.id)
                    .toSorted((left, right) => left.localeCompare(right)),
            ).toEqual([id, removedId].toSorted((left, right) => left.localeCompare(right)));
            const independent = randomUUID();
            await client.query('INSERT INTO "Movie" ("id") VALUES ($1)', [independent]);
            expect(
                (
                    await client.query<{ id: string }>('SELECT "id" FROM "Movie" WHERE "id"=$1', [
                        independent,
                    ])
                ).rows,
            ).toEqual([{ id: independent }]);
        } finally {
            await client.query('ROLLBACK');
            client.release();
            await pool.end();
        }
    });
});
