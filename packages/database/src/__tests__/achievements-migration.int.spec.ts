import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { loadDatabaseEnvironment } from '@pickflick/config/environment';
import { Pool, type PoolClient } from 'pg';

import { assertSafeSeedOrResetTarget } from '../safety.js';

describe('Achievement snapshot migration', () => {
    let pool: Pool;
    let client: PoolClient;
    const userId = randomUUID();
    const clubId = randomUUID();
    const award = `INSERT INTO "AchievementAward" ("key", "version", "title", "description", "target", "progress", "explanation", "evidence", "private", "userId", "clubId")
        VALUES ('test', 1, 'Original title', 'Original description', 1, 1, 'Original explanation', '{"sessionId":"retained"}', true, $1, $2)`;

    beforeEach(async () => {
        const environment = loadDatabaseEnvironment();
        assertSafeSeedOrResetTarget(environment);
        pool = new Pool({ connectionString: environment.databaseUrl });
        client = await pool.connect();
        const schema = `achievements_${randomUUID().replaceAll('-', '')}`;
        await client.query('BEGIN');
        await client.query(`CREATE SCHEMA "${schema}"`);
        await client.query(`SET LOCAL search_path TO "${schema}"`);
        await client.query(
            'CREATE TABLE "User" (id UUID PRIMARY KEY); CREATE TABLE "Club" (id UUID PRIMARY KEY)',
        );
        await client.query('INSERT INTO "User" VALUES ($1)', [userId]);
        await client.query('INSERT INTO "Club" VALUES ($1)', [clubId]);
        const sql = await readFile(
            new URL(
                '../../prisma/migrations/20261030000000_achievements/migration.sql',
                import.meta.url,
            ),
            'utf8',
        );
        await client.query(sql.replaceAll(/^(BEGIN|COMMIT);$/gmu, ''));
    });

    afterEach(async () => {
        await client.query('ROLLBACK');
        client.release();
        await pool.end();
    });

    it('should create earned snapshots directly with privacy, presentation and evidence', async () => {
        await client.query(award, [null, clubId]);
        const { rows } = await client.query('SELECT * FROM "AchievementAward"');
        expect(rows).toMatchObject([
            {
                key: 'test',
                version: 1,
                private: true,
                title: 'Original title',
                description: 'Original description',
                progress: 1,
                target: 1,
                evidence: { sessionId: 'retained' },
                awardedAt: expect.any(Date),
            },
        ]);
        expect(
            (await client.query('SELECT to_regclass(\'"AchievementDefinition"\') AS definition'))
                .rows,
        ).toEqual([{ definition: null }]);
    });

    it.each([
        [null, null],
        [userId, clubId],
    ])('should reject invalid ownership: %s, %s', async (user, club) => {
        await expect(client.query(award, [user, club])).rejects.toMatchObject({ code: '23514' });
    });

    it.each([
        [userId, null],
        [null, clubId],
    ])('should deduplicate each owner scope: %s, %s', async (user, club) => {
        await client.query(award, [user, club]);
        await expect(client.query(award, [user, club])).rejects.toMatchObject({ code: '23505' });
    });

    it('should reject even an unchanged snapshot update', async () => {
        await client.query(award, [userId, null]);
        await expect(
            client.query('UPDATE "AchievementAward" SET "progress" = "progress"'),
        ).rejects.toThrow('immutable');
    });
});
