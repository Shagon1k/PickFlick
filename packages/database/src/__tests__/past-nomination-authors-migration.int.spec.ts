import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { loadDatabaseEnvironment } from '@pickflick/config/environment';
import { Pool } from 'pg';

import { assertSafeSeedOrResetTarget } from '../safety.js';

// Only the pre-migration columns and keys used by migration 30 are needed here.
const BASE_SCHEMA = `
CREATE TABLE "Session" (id UUID PRIMARY KEY, "clubId" UUID NOT NULL);
CREATE TABLE "Membership" (id UUID PRIMARY KEY, "clubId" UUID NOT NULL);
CREATE TABLE "PastNomination" (id UUID PRIMARY KEY, "sessionId" UUID NOT NULL, "movieId" UUID NOT NULL);
CREATE TABLE "PastSelectionScore" ("nominationId" UUID NOT NULL, score INTEGER NOT NULL);
`;

describe('Past nomination authors migration', () => {
    it('should preserve existing nominations and sparse scores with unknown authors', async () => {
        const environment = loadDatabaseEnvironment();
        assertSafeSeedOrResetTarget(environment);
        const pool = new Pool({ connectionString: environment.databaseUrl });
        const client = await pool.connect();
        const schema = `past_authors_${randomUUID().replaceAll('-', '')}`;
        const sessionId = randomUUID();
        const nominationId = randomUUID();
        const movieId = randomUUID();
        try {
            await client.query('BEGIN');
            await client.query(`CREATE SCHEMA "${schema}"`);
            await client.query(`SET LOCAL search_path TO "${schema}"`);
            await client.query(BASE_SCHEMA);
            await client.query('INSERT INTO "Session" VALUES ($1, $2)', [sessionId, randomUUID()]);
            await client.query('INSERT INTO "PastNomination" VALUES ($1, $2, $3)', [
                nominationId,
                sessionId,
                movieId,
            ]);
            await client.query('INSERT INTO "PastSelectionScore" VALUES ($1, 0)', [nominationId]);
            const sql = await readFile(
                new URL(
                    '../../prisma/migrations/20261027000000_past_nomination_authors/migration.sql',
                    import.meta.url,
                ),
                'utf8',
            );
            // Keep the migration inside this disposable schema transaction so cleanup rolls back.
            await client.query(sql.replace(/^BEGIN;/u, '').replace(/COMMIT;\s*$/u, ''));
            expect((await client.query('SELECT * FROM "PastNomination"')).rows).toEqual([
                { id: nominationId, sessionId, movieId, nominatorMembershipId: null },
            ]);
            expect((await client.query('SELECT * FROM "PastSelectionScore"')).rows).toEqual([
                { nominationId, score: 0 },
            ]);
        } finally {
            await client.query('ROLLBACK');
            client.release();
            await pool.end();
        }
    });
});
