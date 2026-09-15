import { readFile } from "node:fs/promises";

import { loadDatabaseEnvironment } from "@pickflick/config/environment";
import { Client } from "pg";

import { createDatabaseClient } from "./client.js";
import { SYNTHETIC_FIXTURES } from "./fixtures.js";
import type { Prisma } from "./generated/prisma/client.js";
import { assertSafeSeedOrResetTarget } from "./safety.js";

const environment = loadDatabaseEnvironment();
assertSafeSeedOrResetTarget(environment);
const database = createDatabaseClient(environment.databaseUrl);

async function runRollbackProbe(action: (transaction: Prisma.TransactionClient) => Promise<unknown>): Promise<void> {
  const rollback = new Error("Rollback database-check probe.");
  try {
    await database.$transaction(async (transaction) => {
      await action(transaction);
      throw rollback;
    });
  } catch (error) {
    if (error === rollback) {
      return;
    }
    throw error;
  }
}

async function expectConstraint(
  action: (transaction: Prisma.TransactionClient) => Promise<unknown>,
  name: string,
): Promise<void> {
  try {
    await runRollbackProbe(action);
  } catch (error) {
    if (error instanceof Error && error.message.includes(name)) {
      return;
    }
    throw new Error(`Expected PostgreSQL constraint ${name} to reject the write.`, { cause: error });
  }
  throw new Error(`PostgreSQL constraint ${name} accepted an invalid write.`);
}

async function verifyMigrationUpgrade(): Promise<void> {
  const suffix = `${process.pid}_${Date.now()}`;
  const schemas = [`pf11_fresh_${suffix}`, `pf11_upgrade_${suffix}`];
  const client = new Client({ connectionString: environment.databaseUrl });
  const initialSql = await readFile(
    new URL("../prisma/migrations/20260906000100_initial_domain_foundation/migration.sql", import.meta.url),
    "utf8",
  );
  const invariantSql = await readFile(
    new URL("../prisma/migrations/20260906000200_enforce_club_session_invariants/migration.sql", import.meta.url),
    "utf8",
  );
  const contactSql = await readFile(
    new URL("../prisma/migrations/20260914000100_add_contact_messages/migration.sql", import.meta.url),
    "utf8",
  );
  await client.connect();
  try {
    for (const schema of schemas) {
      await client.query(`CREATE SCHEMA "${schema}"`);
    }
    await client.query(`SET search_path TO "${schemas[0]}"`);
    await client.query(initialSql);
    await client.query(invariantSql);
    await client.query(contactSql);

    await client.query(`SET search_path TO "${schemas[1]}"`);
    await client.query(initialSql);
    await client.query(
      `INSERT INTO "Club" ("id", "name", "updatedAt") VALUES ('90000000-0000-4000-8000-000000000001', 'Upgrade fixture', NOW())`,
    );
    await client.query(invariantSql);
    await client.query(contactSql);
    const upgraded = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM "Club"`);
    if (upgraded.rows[0]?.count !== "1") {
      throw new Error("Upgrade migration did not preserve the existing Club row.");
    }
  } finally {
    await client.query("SET search_path TO public");
    for (const schema of schemas.reverse()) {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
    await client.end();
  }
}

try {
  const migrationCount = await database.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM "_prisma_migrations" WHERE "finished_at" IS NOT NULL
  `;
  if (migrationCount[0]?.count !== 3n) {
    throw new Error("Expected exactly three completed database migrations.");
  }

  const fixtureCount = await database.user.count({
    where: { id: { in: SYNTHETIC_FIXTURES.users.map(({ id }) => id) } },
  });
  if (fixtureCount !== SYNTHETIC_FIXTURES.users.length) {
    throw new Error("Deterministic synthetic users are missing.");
  }

  const pastSession = await database.session.findUnique({
    where: { id: SYNTHETIC_FIXTURES.pastSession.id },
    select: { type: true, phase: true },
  });
  if (pastSession?.type !== "PAST" || pastSession.phase !== "COMPLETED") {
    throw new Error("The deterministic Past Session must be in the Completed phase.");
  }

  await expectConstraint(
    async (transaction) => {
      await transaction.session.create({
        data: {
          id: "40000000-0000-4000-8000-000000000001",
          clubId: SYNTHETIC_FIXTURES.club.id,
          type: "FULL_CYCLE",
          phase: "NOMINATION",
        },
      });
      await transaction.session.create({
        data: {
          id: "40000000-0000-4000-8000-000000000002",
          clubId: SYNTHETIC_FIXTURES.club.id,
          type: "PRE_SELECTED",
          phase: "WATCHING",
        },
      });
    },
    "Session_one_blocking_per_club_key",
  );
  await runRollbackProbe((transaction) =>
    transaction.session.createMany({
      data: [
        {
          id: "40000000-0000-4000-8000-000000000003",
          clubId: SYNTHETIC_FIXTURES.club.id,
          type: "PAST",
          phase: "COMPLETED",
        },
        {
          id: "40000000-0000-4000-8000-000000000004",
          clubId: SYNTHETIC_FIXTURES.club.id,
          type: "PAST",
          phase: "COMPLETED",
        },
      ],
    }),
  );
  await expectConstraint(
    (transaction) =>
      transaction.club.update({ where: { id: SYNTHETIC_FIXTURES.club.id }, data: { selectionScaleMax: 11 } }),
    "Club_selection_scale_check",
  );
  await expectConstraint(
    (transaction) =>
      transaction.membership.update({
        where: { id: SYNTHETIC_FIXTURES.memberships.member },
        data: { role: "ADMIN" },
      }),
    "Membership_one_active_admin_per_club_key",
  );
  await expectConstraint(
    (transaction) =>
      transaction.contactMessage.create({
        data: {
          id: "50000000-0000-4000-8000-000000000001",
          submissionKey: "50000000-0000-4000-8000-000000000002",
          sourceHash: "a".repeat(64),
          contentHash: "b".repeat(64),
          message: "x".repeat(501),
        },
      }),
    "ContactMessage_message_length_check",
  );
  await expectConstraint(
    (transaction) =>
      transaction.contactMessage.create({
        data: {
          id: "50000000-0000-4000-8000-000000000003",
          submissionKey: "50000000-0000-4000-8000-000000000004",
          sourceHash: "a".repeat(64),
          contentHash: "b".repeat(64),
          deliveryState: "FAILED",
          message: "terminal content must be removed",
        },
      }),
    "ContactMessage_payload_lifecycle_check",
  );
  await verifyMigrationUpgrade();
  console.log("Database checks passed: migrations, upgrade compatibility, deterministic fixtures, and PostgreSQL invariants.");
} finally {
  await database.$disconnect();
}
