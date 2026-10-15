import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { loadDatabaseEnvironment } from '@pickflick/config/environment';
import { Pool } from 'pg';

import { assertSafeSeedOrResetTarget } from '../safety.js';

// Only the pre-migration columns and keys used by migration 24 are needed here.
const SESSION_TABLES = `
    CREATE TABLE "Session" (
        id UUID PRIMARY KEY, phase TEXT NOT NULL, "progressVersion" INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE "SessionParticipant" (
        id UUID PRIMARY KEY, "sessionId" UUID NOT NULL REFERENCES "Session"(id),
        status TEXT NOT NULL, UNIQUE (id, "sessionId"));
    CREATE TABLE "Nomination" (
        id UUID PRIMARY KEY, "sessionId" UUID NOT NULL REFERENCES "Session"(id),
        "participantId" UUID NOT NULL REFERENCES "SessionParticipant"(id));
`;

describe('Selection ballots migration', () => {
    it('should let an in-flight nomination writer finish before locking Nomination', async () => {
        const environment = loadDatabaseEnvironment();
        assertSafeSeedOrResetTarget(environment);
        const pool = new Pool({ connectionString: environment.databaseUrl });
        const observer = await pool.connect();
        const writer = await pool.connect();
        const migrator = await pool.connect();
        const schema = `selection_ballots_${randomUUID().replaceAll('-', '')}`;
        const sessionId = randomUUID();
        const participantId = randomUUID();
        let migration: Promise<unknown> | undefined;
        try {
            await observer.query(`CREATE SCHEMA "${schema}"`);
            for (const client of [observer, writer, migrator]) {
                await client.query(`SET search_path TO "${schema}"`);
                await client.query("SET statement_timeout = '10s'");
            }
            await observer.query(SESSION_TABLES);
            await observer.query('INSERT INTO "Session" (id, phase) VALUES ($1, $2)', [
                sessionId,
                'NOMINATION',
            ]);
            await observer.query('INSERT INTO "SessionParticipant" VALUES ($1, $2, $3)', [
                participantId,
                sessionId,
                'ACCEPTED',
            ]);
            const writerPid = (
                await writer.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
            ).rows[0]!.pid;
            const migratorPid = (
                await migrator.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
            ).rows[0]!.pid;
            const sql = await readFile(
                new URL(
                    '../../prisma/migrations/20261014010000_selection_ballots/migration.sql',
                    import.meta.url,
                ),
                'utf8',
            );

            await writer.query('BEGIN');
            await writer.query('SELECT id FROM "Session" WHERE id = $1 FOR UPDATE', [sessionId]);
            await writer.query('INSERT INTO "Nomination" VALUES ($1, $2, $3)', [
                randomUUID(),
                sessionId,
                participantId,
            ]);
            // Capture failure immediately so a deadlocked migration cannot reject unhandled.
            migration = migrator.query(sql).then(
                () => null,
                (error: unknown) => error,
            );
            await expect
                .poll(async () => {
                    const result = await observer.query<{ blockers: number[] }>(
                        'SELECT pg_blocking_pids($1) AS blockers',
                        [migratorPid],
                    );
                    return result.rows[0]!.blockers;
                })
                .toEqual([writerPid]);

            await writer.query(
                `UPDATE "Session" SET phase = 'SELECTION', "progressVersion" = "progressVersion" + 1
                 WHERE id = $1`,
                [sessionId],
            );
            await writer.query('COMMIT');
            expect(await migration).toBeNull();
            const result = await observer.query<{
                phase: string;
                progressVersion: number;
                isInSelection: boolean;
            }>(
                `SELECT phase, "progressVersion", "isInSelection" FROM "Session"
                 JOIN "Nomination" ON "Nomination"."sessionId" = "Session".id`,
            );
            expect(result.rows).toEqual([
                { phase: 'SELECTION', progressVersion: 2, isInSelection: true },
            ]);
        } finally {
            await writer.query('ROLLBACK');
            await migration;
            await migrator.query('ROLLBACK');
            await observer.query(`DROP SCHEMA "${schema}" CASCADE`);
            observer.release();
            writer.release();
            migrator.release();
            await pool.end();
        }
    });
});
