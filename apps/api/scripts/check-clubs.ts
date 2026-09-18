import { randomUUID } from "node:crypto";
import { Writable } from "node:stream";

import { loadDatabaseEnvironment } from "@pickflick/config/environment";
import { assertSafeSeedOrResetTarget, createDatabaseClient } from "@pickflick/database";
import { createLogger } from "@pickflick/observability";

import { FixtureClubEntitlementResolver } from "../src/clubs/club-entitlements.js";
import { ClubAuthorizationError } from "../src/clubs/club.errors.js";
import { PrismaClubRepository } from "../src/clubs/club.repository.js";
import { ClubPolicyService, ClubRoleTransitionService } from "../src/clubs/clubs.service.js";

const environment = loadDatabaseEnvironment();
assertSafeSeedOrResetTarget(environment);
const database = createDatabaseClient(environment.databaseUrl);
const repository = new PrismaClubRepository(environment);

let logOutput = "";
const logger = createLogger({
  environment: "test",
  service: "api",
  destination: new Writable({
    write(chunk, _encoding, callback) {
      logOutput += chunk.toString();
      callback();
    },
  }),
});
const policy = new ClubPolicyService(repository, new FixtureClubEntitlementResolver());
const transitions = new ClubRoleTransitionService(repository, logger);

const ids = {
  club: randomUUID(),
  admin: randomUUID(),
  moderator: randomUUID(),
  member: randomUUID(),
  outsider: randomUUID(),
  suspended: randomUUID(),
  adminMembership: randomUUID(),
  moderatorMembership: randomUUID(),
  memberMembership: randomUUID(),
  suspendedMembership: randomUUID(),
};

function principal(userId: string) {
  return { appRole: "USER" as const, sessionId: randomUUID(), userId };
}

try {
  await database.$transaction(async (transaction) => {
    await transaction.user.createMany({
      data: [
        { id: ids.admin, email: `${ids.admin}@example.invalid`, displayName: "Club Admin" },
        { id: ids.moderator, email: `${ids.moderator}@example.invalid`, displayName: "Club Moderator" },
        { id: ids.member, email: `${ids.member}@example.invalid`, displayName: "Club Member" },
        { id: ids.outsider, email: `${ids.outsider}@example.invalid`, displayName: "Non-member" },
        {
          id: ids.suspended,
          email: `${ids.suspended}@example.invalid`,
          displayName: "Suspended Admin",
          status: "SUSPENDED",
        },
      ],
    });
    await transaction.club.create({ data: { id: ids.club, name: "Club boundary check" } });
    await transaction.membership.createMany({
      data: [
        { id: ids.adminMembership, clubId: ids.club, userId: ids.admin, role: "ADMIN" },
        { id: ids.moderatorMembership, clubId: ids.club, userId: ids.moderator, role: "MODERATOR" },
        { id: ids.memberMembership, clubId: ids.club, userId: ids.member, role: "MEMBER" },
        { id: ids.suspendedMembership, clubId: ids.club, userId: ids.suspended, role: "MODERATOR" },
      ],
      skipDuplicates: true,
    });
  });

  const adminCount = await database.membership.count({
    where: { clubId: ids.club, role: "ADMIN", status: "ACTIVE" },
  });
  if (adminCount !== 1) {
    throw new Error("The Club did not retain exactly one active Admin.");
  }

  const [adminPolicy, moderatorPolicy, memberPolicy] = await Promise.all([
    policy.project(principal(ids.admin), ids.club),
    policy.project(principal(ids.moderator), ids.club),
    policy.project(principal(ids.member), ids.club),
  ]);
  if (!adminPolicy.permissions.manageRoles || !moderatorPolicy.permissions.manageSessions) {
    throw new Error("Admin or Moderator policy projection is missing an allowed action.");
  }
  if (memberPolicy.permissions.manageSessions || memberPolicy.entitlements.tier !== "FREE") {
    throw new Error("Member policy or fixture entitlements exceed the approved Free boundary.");
  }
  await policy.project(principal(ids.outsider), ids.club).then(
    () => { throw new Error("A non-member received a Club policy projection."); },
    () => undefined,
  );
  await policy.project(principal(ids.suspended), ids.club).then(
    () => { throw new Error("A suspended User received a Club policy projection."); },
    () => undefined,
  );

  const roleOperationId = randomUUID();
  const roleInput = {
    actorUserId: ids.admin,
    clubId: ids.club,
    nextRole: "MODERATOR" as const,
    operationId: roleOperationId,
    targetMembershipId: ids.memberMembership,
  };
  const roleChange = await transitions.changeMembershipRole(roleInput);
  const roleRetry = await transitions.changeMembershipRole(roleInput);
  if (
    !roleChange.changed ||
    roleChange.replayed ||
    !roleRetry.changed ||
    !roleRetry.replayed ||
    roleChange.auditEventId !== roleRetry.auditEventId
  ) {
    throw new Error("Membership role retry did not return the original audited result.");
  }
  if (await database.clubAuditEvent.count({ where: { operationId: roleOperationId } }) !== 1) {
    throw new Error("Membership role retry emitted more than one audit event.");
  }

  await transitions.changeMembershipRole({ ...roleInput, actorUserId: ids.moderator, operationId: randomUUID() }).then(
    () => { throw new Error("A Moderator changed a Membership role."); },
    (error: unknown) => {
      if (!(error instanceof ClubAuthorizationError)) {
        throw error;
      }
    },
  );

  const transferOperationId = randomUUID();
  const transferInput = {
    actorUserId: ids.admin,
    clubId: ids.club,
    operationId: transferOperationId,
    previousAdminNextRole: "MEMBER" as const,
    targetMembershipId: ids.moderatorMembership,
  };
  const transfer = await transitions.transferAdministration(transferInput);
  const transferRetry = await transitions.transferAdministration(transferInput);
  if (
    !transfer.changed ||
    transfer.replayed ||
    !transferRetry.changed ||
    !transferRetry.replayed ||
    transfer.auditEventId !== transferRetry.auditEventId
  ) {
    throw new Error("Administration transfer retry did not return the original audited result.");
  }
  const activeAdmins = await database.membership.findMany({
    where: { clubId: ids.club, role: "ADMIN", status: "ACTIVE" },
    select: { userId: true },
  });
  if (activeAdmins.length !== 1 || activeAdmins[0]?.userId !== ids.moderator) {
    throw new Error("Administration transfer did not leave exactly the intended active Admin.");
  }
  const transferAudit = await database.clubAuditEvent.findUnique({ where: { operationId: transferOperationId } });
  if (
    transferAudit?.action !== "ADMIN_TRANSFERRED" ||
    transferAudit.previousAdminUserId !== ids.admin ||
    transferAudit.previousAdminNextRole !== "MEMBER"
  ) {
    throw new Error("Administration transfer audit record is incomplete.");
  }
  if (
    logOutput.includes(ids.club) ||
    logOutput.includes(ids.admin) ||
    logOutput.includes(ids.moderator) ||
    logOutput.includes(ids.member)
  ) {
    throw new Error("Club security logs exposed a Club, User, or Membership identifier.");
  }

  console.log(
    "Club checks passed: private policy projections, fixture entitlements, serialized role changes, idempotent transfer, and audit-safe records.",
  );
} finally {
  await database.clubAuditEvent.deleteMany({ where: { clubId: ids.club } });
  await database.membership.deleteMany({ where: { clubId: ids.club } });
  await database.club.deleteMany({ where: { id: ids.club } });
  await database.user.deleteMany({
    where: { id: { in: [ids.admin, ids.moderator, ids.member, ids.outsider, ids.suspended] } },
  });
  await repository.onModuleDestroy();
  await database.$disconnect();
}
