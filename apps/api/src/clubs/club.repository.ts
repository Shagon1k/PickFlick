import { Injectable } from "@nestjs/common";

import { canonicalUuid } from "../common/validation/uuid.js";
import { lockKeys } from "../database/advisory-lock.js";
import { DatabaseService } from "../database/database.service.js";
import { ClubAuthorizationError, ClubConflictError } from "./club.errors.js";
import type { PersistClubInput, StoredClubSummary } from "./club-onboarding.types.js";
import type { ClubPolicySubject } from "./club-policy.js";

export abstract class ClubRepository {
  abstract create(input: PersistClubInput, adminClubLimit: number): Promise<StoredClubSummary>;
  abstract listForUser(userId: string): Promise<readonly StoredClubSummary[]>;
  abstract readPolicySubject(userId: string, clubId: string): Promise<ClubPolicySubject>;
}

@Injectable()
export class PrismaClubRepository extends ClubRepository {
  constructor(private readonly database: DatabaseService) {
    super();
  }

  async create(input: PersistClubInput, adminClubLimit: number): Promise<StoredClubSummary> {
    const creatorUserId = canonicalUuid(input.creatorUserId);
    return this.database.client.$transaction(async (transaction) => {
      await lockKeys(transaction, `club-creation:${creatorUserId}`);

      const creator = await transaction.user.findUnique({
        where: { id: creatorUserId },
        select: {
          status: true,
          memberships: {
            where: {
              role: "ADMIN",
              status: "ACTIVE",
              club: { lifecycle: "ACTIVE" },
            },
            select: { id: true },
          },
        },
      });
      if (creator?.status !== "ACTIVE") {
        throw new ClubAuthorizationError("The current User cannot create a Club.");
      }
      if (creator.memberships.length >= adminClubLimit) {
        throw new ClubConflictError("ADMIN_CLUB_LIMIT_REACHED", "The current User has reached the administered Club limit.");
      }

      const club = await transaction.club.create({
        data: {
          id: canonicalUuid(input.clubId),
          name: input.name,
          ...(input.description ? { description: input.description } : {}),
          selectionScaleMin: input.selectionScaleMin,
          selectionScaleMax: input.selectionScaleMax,
          memberships: {
            create: {
              id: canonicalUuid(input.membershipId),
              userId: creatorUserId,
              role: "ADMIN",
            },
          },
        },
        select: {
          id: true,
          name: true,
          description: true,
          avatarObjectKey: true,
          lifecycle: true,
          selectionScaleMin: true,
          selectionScaleMax: true,
        },
      });

      return {
        id: club.id,
        name: club.name,
        ...(club.description ? { description: club.description } : {}),
        hasAvatar: Boolean(club.avatarObjectKey),
        lifecycle: club.lifecycle,
        membershipRole: "ADMIN",
        selectionScaleMin: club.selectionScaleMin as 0 | 1,
        selectionScaleMax: club.selectionScaleMax,
      };
    });
  }

  async listForUser(userId: string): Promise<readonly StoredClubSummary[]> {
    const memberships = await this.database.client.membership.findMany({
      where: { userId: canonicalUuid(userId), status: "ACTIVE", club: { deletedAt: null } },
      orderBy: [{ club: { updatedAt: "desc" } }, { joinedAt: "asc" }],
      select: {
        role: true,
        club: {
          select: {
            id: true,
            name: true,
            description: true,
            avatarObjectKey: true,
            lifecycle: true,
            selectionScaleMin: true,
            selectionScaleMax: true,
          },
        },
      },
    });
    return memberships.map(({ club, role }) => ({
      id: club.id,
      name: club.name,
      ...(club.description ? { description: club.description } : {}),
      hasAvatar: Boolean(club.avatarObjectKey),
      lifecycle: club.lifecycle,
      membershipRole: role,
      selectionScaleMin: club.selectionScaleMin as 0 | 1,
      selectionScaleMax: club.selectionScaleMax,
    }));
  }

  async readPolicySubject(userId: string, clubId: string): Promise<ClubPolicySubject> {
    const canonicalUserId = canonicalUuid(userId);
    const canonicalClubId = canonicalUuid(clubId);
    const user = await this.database.client.user.findUnique({
      where: { id: canonicalUserId },
      select: {
        appRole: true,
        status: true,
        memberships: {
          where: { clubId: canonicalClubId, status: "ACTIVE", club: { deletedAt: null } },
          take: 1,
          select: { role: true, club: { select: { lifecycle: true } } },
        },
      },
    });
    const membership = user?.memberships[0];
    return {
      appRole: user?.appRole ?? "USER",
      clubRole: membership?.role ?? null,
      lifecycle: membership?.club.lifecycle ?? null,
      userStatus: user?.status ?? "ANONYMIZED",
    };
  }
}
