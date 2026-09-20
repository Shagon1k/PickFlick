import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
import { ClubAvatarStorage, S3ClubAvatarStorage } from "./club-avatar.storage.js";
import {
  ClubManagementRepository,
  PrismaClubManagementRepository,
} from "./club-management.repository.js";
import { ClubManagementService } from "./club-management.service.js";
import { ClubRepository, PrismaClubRepository } from "./club.repository.js";
import { ClubTierResolver, StaticClubTierResolver } from "./club-tiers.js";
import { ClubsController } from "./clubs.controller.js";
import { ClubOnboardingService, ClubPolicyService, ClubRoleTransitionService } from "./clubs.service.js";

@Module({
  imports: [DatabaseModule],
  controllers: [ClubsController],
  providers: [
    ClubOnboardingService,
    ClubPolicyService,
    ClubRoleTransitionService,
    ClubManagementService,
    { provide: ClubRepository, useClass: PrismaClubRepository },
    { provide: ClubManagementRepository, useClass: PrismaClubManagementRepository },
    { provide: ClubTierResolver, useClass: StaticClubTierResolver },
    { provide: ClubAvatarStorage, useClass: S3ClubAvatarStorage },
  ],
})
export class ClubsModule {}
