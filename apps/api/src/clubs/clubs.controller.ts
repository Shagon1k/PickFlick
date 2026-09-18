import { Controller, Get, Header, Param, ParseUUIDPipe, Req } from "@nestjs/common";
import type { ClubPolicyProjection } from "@pickflick/contracts";

import {
  AUTHENTICATED_PRINCIPAL,
  type AuthenticatedRequest,
} from "../identity/authorization.types.js";
import { ClubPolicyService } from "./clubs.service.js";

@Controller("clubs")
export class ClubsController {
  constructor(private readonly policy: ClubPolicyService) {}

  @Get(":clubId/policy")
  @Header("Cache-Control", "private, no-store")
  async projectPolicy(
    @Param("clubId", new ParseUUIDPipe({ version: "4" })) clubId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ClubPolicyProjection> {
    const principal = request[AUTHENTICATED_PRINCIPAL];
    if (!principal) {
      throw new Error("Authentication guard did not attach a principal.");
    }
    return this.policy.project(principal, clubId);
  }
}
