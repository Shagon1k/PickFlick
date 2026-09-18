import { randomUUID } from "node:crypto";
import { Writable } from "node:stream";

import { loadDatabaseEnvironment } from "@pickflick/config/environment";
import { SYNTHETIC_FIXTURES, assertSafeSeedOrResetTarget } from "@pickflick/database";
import { createLogger } from "@pickflick/observability";

import { ClubAuthorizationError, ClubConflictError } from "../src/clubs/club.errors.js";
import { PrismaClubRepository } from "../src/clubs/club.repository.js";
import { StaticClubTierResolver } from "../src/clubs/club-tiers.js";
import {
  ClubOnboardingService,
  ClubPolicyService,
  ClubRoleTransitionService,
} from "../src/clubs/clubs.service.js";
import { DatabaseService } from "../src/database/database.service.js";

const environment = loadDatabaseEnvironment();
assertSafeSeedOrResetTarget(environment);
const databaseService = new DatabaseService(environment);
const database = databaseService.client;
const repository = new PrismaClubRepository(databaseService);

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
const policy = new ClubPolicyService(repository, new StaticClubTierResolver());
const onboarding = new ClubOnboardingService(repository, new StaticClubTierResolver(), logger);
const transitions = new ClubRoleTransitionService(repository, logger);

const ids = {
  club: randomUUID(),
  admin: randomUUID(),
  appAdmin: randomUUID(),
  moderator: randomUUID(),
  member: randomUUID(),
  outsider: randomUUID(),
  creator: randomUUID(),
  suspended: randomUUID(),
  anonymized: randomUUID(),
  adminMembership: randomUUID(),
  moderatorMembership: randomUUID(),
  memberMembership: randomUUID(),
  suspendedMembership: randomUUID(),
  anonymizedMembership: randomUUID(),
};

let createdClubId: string | undefined;

function principal(userId: string) {
  return { appRole: "USER" as const, sessionId: randomUUID(), userId };
}

try {
  await database.$transaction(async (transaction) => {
    await transaction.user.createMany({
      data: [
        { id: ids.admin, email: `${ids.admin}@example.invalid`, displayName: "Club Admin" },
        {
          id: ids.appAdmin,
          email: `${ids.appAdmin}@example.invalid`,
          displayName: "App Admin",
          appRole: "APP_ADMIN",
        },
        { id: ids.moderator, email: `${ids.moderator}@example.invalid`, displayName: "Club Moderator" },
        { id: ids.member, email: `${ids.member}@example.invalid`, displayName: "Club Member" },
        { id: ids.outsider, email: `${ids.outsider}@example.invalid`, displayName: "Non-member" },
        { id: ids.creator, email: `${ids.creator}@example.invalid`, displayName: "First Club Creator" },
        {
          id: ids.suspended,
          email: `${ids.suspended}@example.invalid`,
          displayName: "Suspended Admin",
          status: "SUSPENDED",
        },
        {
          id: ids.anonymized,
          email: `${ids.anonymized}@example.invalid`,
          displayName: "Anonymized Member",
          status: "ANONYMIZED",
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
        { id: ids.anonymizedMembership, clubId: ids.club, userId: ids.anonymized, role: "MEMBER" },
      ],
      skipDuplicates: true,
    });
  });

  const creationAttempts = await Promise.allSettled([
    onboarding.create(principal(ids.creator), {
      name: "  Midnight Society  ",
      description: "  Noir, classics, and arguments.  ",
      selectionScaleMin: 0,
      selectionScaleMax: 7,
    }),
    onboarding.create(principal(ids.creator), {
      name: "Second Club",
      selectionScaleMin: 1,
      selectionScaleMax: 5,
    }),
  ]);
  const fulfilledCreations = creationAttempts.filter(
    (attempt): attempt is PromiseFulfilledResult<Awaited<ReturnType<typeof onboarding.create>>> =>
      attempt.status === "fulfilled",
  );
  const rejectedCreations = creationAttempts.filter(
    (attempt): attempt is PromiseRejectedResult => attempt.status === "rejected",
  );
  if (
    fulfilledCreations.length !== 1 ||
    rejectedCreations.length !== 1 ||
    !(rejectedCreations[0]?.reason instanceof ClubConflictError)
  ) {
    throw new Error("Concurrent first-Club creation did not enforce the Free Admin Club limit.");
  }
  const createdClub = fulfilledCreations[0]?.value.club;
  createdClubId = createdClub?.id;
  if (
    !createdClub ||
    createdClub.name !== "Midnight Society" ||
    createdClub.description !== "Noir, classics, and arguments." ||
    createdClub.membershipRole !== "ADMIN" ||
    createdClub.tier !== "FREE" ||
    createdClub.selectionScaleMin !== 0 ||
    createdClub.selectionScaleMax !== 7
  ) {
    throw new Error("First-Club creation did not preserve the validated Free defaults and scale.");
  }
  const createdMemberships = await database.membership.findMany({
    where: { clubId: createdClub.id },
    select: { role: true, status: true, userId: true },
  });
  if (
    createdMemberships.length !== 1 ||
    createdMemberships[0]?.userId !== ids.creator ||
    createdMemberships[0].role !== "ADMIN" ||
    createdMemberships[0].status !== "ACTIVE"
  ) {
    throw new Error("First-Club creation did not atomically create the sole active Admin Membership.");
  }
  const creatorClubs = await onboarding.list(principal(ids.creator));
  if (creatorClubs.clubs.length !== 1 || creatorClubs.clubs[0]?.id !== createdClub.id) {
    throw new Error("The creator's Club collection did not include the new Club.");
  }

  const adminCount = await database.membership.count({
    where: { clubId: ids.club, role: "ADMIN", status: "ACTIVE" },
  });
  if (adminCount !== 1) {
    throw new Error("The Club did not retain exactly one active Admin.");
  }

  const [adminPolicy, moderatorPolicy, memberPolicy, seededProPolicy] = await Promise.all([
    policy.project(principal(ids.admin), ids.club),
    policy.project(principal(ids.moderator), ids.club),
    policy.project(principal(ids.member.toUpperCase()), ids.club.toUpperCase()),
    policy.project(
      principal(SYNTHETIC_FIXTURES.users[0].id.toUpperCase()),
      SYNTHETIC_FIXTURES.club.id.toUpperCase(),
    ),
  ]);
  if (
    !adminPolicy.permissions.manageRoles ||
    "transferAdministration" in adminPolicy.permissions ||
    !moderatorPolicy.permissions.manageSessions
  ) {
    throw new Error("Admin or Moderator policy projection is missing an allowed action.");
  }
  if (memberPolicy.permissions.manageSessions || memberPolicy.entitlements.tier !== "FREE") {
    throw new Error("Member policy or static tier limits exceed the approved Free boundary.");
  }
  if (seededProPolicy.entitlements.tier !== "PRO" || seededProPolicy.entitlements.memberLimit !== 16) {
    throw new Error("The seeded Pro Club did not receive its approved tier limits.");
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
  const roleRetry = await transitions.changeMembershipRole({
    ...roleInput,
    actorUserId: roleInput.actorUserId.toUpperCase(),
    clubId: roleInput.clubId.toUpperCase(),
    operationId: roleInput.operationId.toUpperCase(),
    targetMembershipId: roleInput.targetMembershipId.toUpperCase(),
  });
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

  const noOpOperationId = randomUUID();
  const noOpInput = { ...roleInput, operationId: noOpOperationId };
  const noOp = await transitions.changeMembershipRole(noOpInput);
  const noOpReceipt = await database.clubAuditEvent.findUnique({ where: { operationId: noOpOperationId } });
  if (noOp.changed || noOpReceipt?.changed !== false) {
    throw new Error("An accepted no-op Membership role change did not persist its result.");
  }
  await transitions.changeMembershipRole({ ...roleInput, nextRole: "MEMBER", operationId: randomUUID() });
  const noOpRetry = await transitions.changeMembershipRole({
    ...noOpInput,
    operationId: noOpInput.operationId.toUpperCase(),
    targetMembershipId: noOpInput.targetMembershipId.toUpperCase(),
  });
  const roleAfterNoOpRetry = await database.membership.findUnique({
    where: { id: ids.memberMembership },
    select: { role: true },
  });
  if (noOpRetry.changed || roleAfterNoOpRetry?.role !== "MEMBER") {
    throw new Error("A retried no-op Membership role operation changed a later role state.");
  }

  await transitions.changeMembershipRole({ ...roleInput, actorUserId: ids.moderator, operationId: randomUUID() }).then(
    () => { throw new Error("A Moderator changed a Membership role."); },
    (error: unknown) => {
      if (!(error instanceof ClubAuthorizationError)) {
        throw error;
      }
    },
  );

  await database.club.update({ where: { id: ids.club }, data: { lifecycle: "ARCHIVED" } });
  await transitions.changeMembershipRole({ ...roleInput, nextRole: "MEMBER", operationId: randomUUID() }).then(
    () => { throw new Error("An archived Club allowed an ordinary Membership role change."); },
    (error: unknown) => {
      if (!(error instanceof ClubConflictError)) {
        throw error;
      }
    },
  );
  await database.club.update({ where: { id: ids.club }, data: { lifecycle: "ACTIVE" } });

  await transitions.transferAdministration({
    actorUserId: ids.admin,
    clubId: ids.club,
    operationId: randomUUID(),
    previousAdminNextRole: "MEMBER",
    targetMembershipId: ids.moderatorMembership,
  }).then(
    () => { throw new Error("A Club Admin used the App Admin ownership-transfer path."); },
    (error: unknown) => {
      if (!(error instanceof ClubAuthorizationError)) {
        throw error;
      }
    },
  );

  for (const [status, targetMembershipId] of [
    ["suspended", ids.suspendedMembership],
    ["anonymized", ids.anonymizedMembership],
  ] as const) {
    await transitions.transferAdministration({
      actorUserId: ids.appAdmin,
      clubId: ids.club,
      operationId: randomUUID(),
      previousAdminNextRole: "MEMBER",
      targetMembershipId,
    }).then(
      () => { throw new Error(`A ${status} User became the Club Admin.`); },
      (error: unknown) => {
        if (!(error instanceof ClubConflictError)) {
          throw error;
        }
      },
    );
  }

  const transferOperationId = randomUUID();
  const transferInput = {
    actorUserId: ids.appAdmin,
    clubId: ids.club,
    operationId: transferOperationId,
    previousAdminNextRole: "MEMBER" as const,
    targetMembershipId: ids.moderatorMembership,
  };
  const transfer = await transitions.transferAdministration(transferInput);
  const transferRetry = await transitions.transferAdministration({
    ...transferInput,
    actorUserId: transferInput.actorUserId.toUpperCase(),
    clubId: transferInput.clubId.toUpperCase(),
    operationId: transferInput.operationId.toUpperCase(),
    targetMembershipId: transferInput.targetMembershipId.toUpperCase(),
  });
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
    logOutput.includes(ids.appAdmin) ||
    logOutput.includes(ids.moderator) ||
    logOutput.includes(ids.member)
  ) {
    throw new Error("Club security logs exposed a Club, User, or Membership identifier.");
  }

  console.log(
    "Club checks passed: transactional first-Club creation, serialized Free limits, private policy projections, static Free/Pro tiers, archived-Club denial, App Admin ownership transfer, UUID canonicalization, durable no-op receipts, serialized role changes, idempotent transfer, and audit-safe records.",
  );
} finally {
  if (createdClubId) {
    await database.membership.deleteMany({ where: { clubId: createdClubId } });
    await database.club.deleteMany({ where: { id: createdClubId } });
  }
  await database.clubAuditEvent.deleteMany({ where: { clubId: ids.club } });
  await database.membership.deleteMany({ where: { clubId: ids.club } });
  await database.club.deleteMany({ where: { id: ids.club } });
  await database.user.deleteMany({
    where: {
      id: {
        in: [ids.admin, ids.appAdmin, ids.moderator, ids.member, ids.outsider, ids.creator, ids.suspended, ids.anonymized],
      },
    },
  });
  await databaseService.onModuleDestroy();
}
