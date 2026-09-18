import { randomUUID } from "node:crypto";

import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import type {
  ClubCollectionResponse,
  ClubPolicyProjection,
  CreateClubResponse,
} from "@pickflick/contracts";
import type { ApplicationLogger } from "@pickflick/observability";

import type { AuthenticatedPrincipal } from "../identity/authorization.types.js";
import { APPLICATION_LOGGER } from "../runtime.tokens.js";
import { ClubValidationError } from "./club.errors.js";
import { parseCreateClubInput } from "./club-onboarding.validation.js";
import { projectClubPermissions } from "./club-policy.js";
import {
  ClubRepository,
  type ChangeMembershipRoleInput,
  type ClubTransitionResult,
  type TransferAdministrationInput,
} from "./club.repository.js";
import { clubTierLimits, ClubTierResolver } from "./club-tiers.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function assertUuid(value: string, field: string): void {
  if (!uuidPattern.test(value)) {
    throw new ClubValidationError(`${field} must be a UUID.`);
  }
}

@Injectable()
export class ClubPolicyService {
  constructor(
    private readonly repository: ClubRepository,
    private readonly tiers: ClubTierResolver,
  ) {}

  async project(principal: AuthenticatedPrincipal, clubId: string): Promise<ClubPolicyProjection> {
    const subject = await this.repository.readPolicySubject(principal.userId, clubId);
    const permissions = projectClubPermissions(subject);
    if (!subject.clubRole || !subject.lifecycle || !permissions.viewClub) {
      throw new ForbiddenException();
    }
    return {
      clubId,
      lifecycle: subject.lifecycle,
      membershipRole: subject.clubRole,
      permissions,
      entitlements: await this.tiers.resolve(clubId),
    };
  }
}

@Injectable()
export class ClubOnboardingService {
  constructor(
    private readonly repository: ClubRepository,
    private readonly tiers: ClubTierResolver,
    @Inject(APPLICATION_LOGGER) private readonly logger: ApplicationLogger,
  ) {}

  async list(principal: AuthenticatedPrincipal): Promise<ClubCollectionResponse> {
    const storedClubs = await this.repository.listForUser(principal.userId);
    const clubs = await Promise.all(storedClubs.map(async (club) => ({
      ...club,
      tier: (await this.tiers.resolve(club.id)).tier,
    })));
    return { clubs };
  }

  async create(principal: AuthenticatedPrincipal, value: unknown): Promise<CreateClubResponse> {
    const input = parseCreateClubInput(value);
    const freeTier = clubTierLimits("FREE");
    const storedClub = await this.repository.create(
      {
        ...input,
        clubId: randomUUID(),
        creatorUserId: principal.userId,
        membershipId: randomUUID(),
      },
      freeTier.adminClubLimit,
    );
    this.logger.info({ event: "club.created", tier: freeTier.tier }, "Club created.");
    return { club: { ...storedClub, tier: freeTier.tier } };
  }
}

@Injectable()
export class ClubRoleTransitionService {
  constructor(
    private readonly repository: ClubRepository,
    @Inject(APPLICATION_LOGGER) private readonly logger: ApplicationLogger,
  ) {}

  async changeMembershipRole(input: ChangeMembershipRoleInput): Promise<ClubTransitionResult> {
    assertUuid(input.actorUserId, "actorUserId");
    assertUuid(input.clubId, "clubId");
    assertUuid(input.operationId, "operationId");
    assertUuid(input.targetMembershipId, "targetMembershipId");
    if (input.nextRole !== "MODERATOR" && input.nextRole !== "MEMBER") {
      throw new ClubValidationError("nextRole must be MODERATOR or MEMBER.");
    }
    const result = await this.repository.changeMembershipRole(input);
    if (result.changed && !result.replayed) {
      this.logger.info({ event: "club.membership.role_changed" }, "Club Membership role changed.");
    }
    return result;
  }

  async transferAdministration(input: TransferAdministrationInput): Promise<ClubTransitionResult> {
    assertUuid(input.actorUserId, "actorUserId");
    assertUuid(input.clubId, "clubId");
    assertUuid(input.operationId, "operationId");
    assertUuid(input.targetMembershipId, "targetMembershipId");
    if (input.previousAdminNextRole !== "MODERATOR" && input.previousAdminNextRole !== "MEMBER") {
      throw new ClubValidationError("previousAdminNextRole must be MODERATOR or MEMBER.");
    }
    const result = await this.repository.transferAdministration(input);
    if (result.changed && !result.replayed) {
      this.logger.info({ event: "club.admin.transferred" }, "Club administration transferred.");
    }
    return result;
  }
}
