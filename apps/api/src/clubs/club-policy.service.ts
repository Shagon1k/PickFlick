import { ForbiddenException, Injectable } from "@nestjs/common";
import type { ClubPolicyProjection } from "@pickflick/contracts";

import type { AuthenticatedPrincipal } from "../identity/authorization.types.js";
import { projectClubPermissions } from "./club-policy.js";
import { ClubRepository } from "./club.repository.js";
import { ClubTierResolver } from "./club-tiers.js";

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
