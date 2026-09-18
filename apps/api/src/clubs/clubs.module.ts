import { Module } from "@nestjs/common";

import { DatabaseModule } from "../database/database.module.js";
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
    { provide: ClubRepository, useClass: PrismaClubRepository },
    { provide: ClubTierResolver, useClass: StaticClubTierResolver },
  ],
})
export class ClubsModule {}
