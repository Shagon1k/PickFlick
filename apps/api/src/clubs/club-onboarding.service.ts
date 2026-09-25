import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type { ClubCollectionResponse, CreateClubResponse } from "@pickflick/contracts";
import type { ApplicationLogger } from "@pickflick/observability";

import type { AuthenticatedPrincipal } from "../identity/authorization.types.js";
import { APPLICATION_LOGGER } from "../runtime.tokens.js";
import { parseCreateClubInput } from "./club-onboarding.validation.js";
import { ClubRepository } from "./club.repository.js";
import { clubTierLimits, ClubTierResolver } from "./club-tiers.js";

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
