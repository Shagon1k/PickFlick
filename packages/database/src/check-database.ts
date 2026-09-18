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
  const schemas = [`pf12_fresh_${suffix}`, `pf12_upgrade_${suffix}`, `pf12_email_collision_${suffix}`];
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
  const authenticationSql = await readFile(
    new URL("../prisma/migrations/20260916000100_add_google_authentication/migration.sql", import.meta.url),
    "utf8",
  );
  const appleProfileSql = await readFile(
    new URL("../prisma/migrations/20260917000100_add_apple_provider_profile/migration.sql", import.meta.url),
    "utf8",
  );
  const clubMembershipSql = await readFile(
    new URL("../prisma/migrations/20260918000100_harden_club_membership_roles/migration.sql", import.meta.url),
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
    await client.query(authenticationSql);
    await client.query(appleProfileSql);
    await client.query(clubMembershipSql);

    await client.query(`SET search_path TO "${schemas[1]}"`);
    await client.query(initialSql);
    await client.query(
      `INSERT INTO "Club" ("id", "name", "updatedAt") VALUES ('90000000-0000-4000-8000-000000000001', 'Upgrade fixture', NOW())`,
    );
    await client.query(
      `INSERT INTO "User" ("id", "email", "displayName", "updatedAt") VALUES ('90000000-0000-4000-8000-000000000002', 'Alice@Example.invalid', 'Alice', NOW())`,
    );
    await client.query(invariantSql);
    await client.query(contactSql);
    await client.query(authenticationSql);
    await client.query(appleProfileSql);
    await client.query(
      `INSERT INTO "Membership" ("id", "clubId", "userId", "role") VALUES
        ('90000000-0000-4000-8000-000000000005', '90000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000002', 'ADMIN')`,
    );
    await client.query(clubMembershipSql);
    const upgraded = await client.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM "Club"`);
    if (upgraded.rows[0]?.count !== "1") {
      throw new Error("Upgrade migration did not preserve the existing Club row.");
    }
    const normalizedUser = await client.query<{ email: string }>(
      `SELECT "email" FROM "User" WHERE "id" = '90000000-0000-4000-8000-000000000002'`,
    );
    if (normalizedUser.rows[0]?.email !== "alice@example.invalid") {
      throw new Error("Authentication migration did not normalize an existing mixed-case email.");
    }
    const upgradedMembership = await client.query<{ updatedAt: Date }>(
      `SELECT "updatedAt" FROM "Membership" WHERE "id" = '90000000-0000-4000-8000-000000000005'`,
    );
    if (!upgradedMembership.rows[0]?.updatedAt) {
      throw new Error("Club membership migration did not preserve and timestamp an existing Membership row.");
    }

    await client.query(`SET search_path TO "${schemas[2]}"`);
    await client.query(initialSql);
    await client.query(invariantSql);
    await client.query(contactSql);
    await client.query(
      `INSERT INTO "User" ("id", "email", "displayName", "updatedAt") VALUES
        ('90000000-0000-4000-8000-000000000003', 'Alice@Example.invalid', 'Alice One', NOW()),
        ('90000000-0000-4000-8000-000000000004', 'alice@example.invalid', 'Alice Two', NOW())`,
    );
    let rejectedCaseCollision = false;
    try {
      await client.query(authenticationSql);
    } catch (error) {
      if (error instanceof Error && error.message.includes("Existing User emails conflict after case normalization")) {
        rejectedCaseCollision = true;
      } else {
        throw error;
      }
    }
    if (!rejectedCaseCollision) {
      throw new Error("Authentication migration accepted case-colliding existing User emails.");
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
  if (migrationCount[0]?.count !== 6n) {
    throw new Error("Expected exactly six completed database migrations.");
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
    (transaction) =>
      transaction.user.create({
        data: {
          id: "60000000-0000-4000-8000-000000000005",
          displayName: "Case Collision",
          email: SYNTHETIC_FIXTURES.users[0].email.toUpperCase(),
        },
      }),
    "User_email_normalized_key",
  );
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
      transaction.membership.create({
        data: {
          id: "40000000-0000-4000-8000-000000000005",
          clubId: SYNTHETIC_FIXTURES.club.id,
          userId: SYNTHETIC_FIXTURES.users[1].id,
          role: "MEMBER",
        },
      }),
    "Membership_one_active_per_user_club_key",
  );
  await runRollbackProbe(async (transaction) => {
    await transaction.membership.update({
      where: { id: SYNTHETIC_FIXTURES.memberships.member },
      data: { status: "LEFT", leftAt: new Date() },
    });
    await transaction.membership.create({
      data: {
        id: "40000000-0000-4000-8000-000000000006",
        clubId: SYNTHETIC_FIXTURES.club.id,
        userId: SYNTHETIC_FIXTURES.users[1].id,
        role: "MEMBER",
      },
    });
  });
  await expectConstraint(
    (transaction) =>
      transaction.membership.update({
        where: { id: SYNTHETIC_FIXTURES.memberships.member },
        data: { status: "LEFT", leftAt: null },
      }),
    "Membership_status_departure_check",
  );
  await runRollbackProbe((transaction) =>
    transaction.membership.update({
      where: { id: SYNTHETIC_FIXTURES.memberships.admin },
      data: { role: "MODERATOR" },
    }),
  );
  await expectConstraint(
    (transaction) =>
      transaction.clubAuditEvent.create({
        data: {
          operationId: "40000000-0000-4000-8000-000000000007",
          clubId: SYNTHETIC_FIXTURES.club.id,
          actorUserId: SYNTHETIC_FIXTURES.users[0].id,
          subjectUserId: SYNTHETIC_FIXTURES.users[1].id,
          subjectMembershipId: SYNTHETIC_FIXTURES.memberships.member,
          action: "MEMBERSHIP_ROLE_CHANGED",
          previousRole: "MEMBER",
          nextRole: "MEMBER",
        },
      }),
    "ClubAuditEvent_changed_role_check",
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
  await expectConstraint(
    async (transaction) => {
      await transaction.providerAccount.createMany({
        data: [
          {
            id: "60000000-0000-4000-8000-000000000001",
            provider: "google",
            providerSubject: "same-google-subject",
            userId: SYNTHETIC_FIXTURES.users[0].id,
          },
          {
            id: "60000000-0000-4000-8000-000000000002",
            provider: "google",
            providerSubject: "same-google-subject",
            userId: SYNTHETIC_FIXTURES.users[1].id,
          },
        ],
      });
    },
    "ProviderAccount_provider_providerSubject_key",
  );
  await expectConstraint(
    async (transaction) => {
      await transaction.authSession.createMany({
        data: [
          {
            id: "60000000-0000-4000-8000-000000000003",
            expiresAt: new Date(Date.now() + 60_000),
            token: "duplicate-opaque-session-token",
            userId: SYNTHETIC_FIXTURES.users[0].id,
          },
          {
            id: "60000000-0000-4000-8000-000000000004",
            expiresAt: new Date(Date.now() + 60_000),
            token: "duplicate-opaque-session-token",
            userId: SYNTHETIC_FIXTURES.users[1].id,
          },
        ],
      });
    },
    "AuthSession_token_key",
  );
  await verifyMigrationUpgrade();
  console.log("Database checks passed: migrations, upgrade compatibility, deterministic fixtures, and PostgreSQL invariants.");
} finally {
  await database.$disconnect();
}
