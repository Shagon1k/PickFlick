import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import type {
  ClubCollectionResponse,
  ClubPolicyProjection,
  CreateClubResponse,
} from "@pickflick/contracts";

import {
  AUTHENTICATED_PRINCIPAL,
  type AuthenticatedRequest,
} from "../identity/authorization.types.js";
import { ClubConflictError, ClubValidationError } from "./club.errors.js";
import { ClubOnboardingService, ClubPolicyService } from "./clubs.service.js";

function principal(request: AuthenticatedRequest) {
  const authenticatedPrincipal = request[AUTHENTICATED_PRINCIPAL];
  if (!authenticatedPrincipal) {
    throw new Error("Authentication guard did not attach a principal.");
  }
  return authenticatedPrincipal;
}

function acceptsJsonBody(request: AuthenticatedRequest): boolean {
  const contentType = request.headers["content-type"];
  return typeof contentType === "string" && contentType.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
}

@Controller("clubs")
export class ClubsController {
  constructor(
    private readonly onboarding: ClubOnboardingService,
    private readonly policy: ClubPolicyService,
  ) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  async list(@Req() request: AuthenticatedRequest): Promise<ClubCollectionResponse> {
    return this.onboarding.list(principal(request));
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Header("Cache-Control", "private, no-store")
  async create(
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<CreateClubResponse> {
    if (!acceptsJsonBody(request)) {
      throw new UnsupportedMediaTypeException();
    }
    try {
      return await this.onboarding.create(principal(request), body);
    } catch (error) {
      if (error instanceof ClubValidationError) {
        throw new BadRequestException();
      }
      if (error instanceof ClubConflictError) {
        throw new ConflictException();
      }
      throw error;
    }
  }

  @Get(":clubId/policy")
  @Header("Cache-Control", "private, no-store")
  async projectPolicy(
    @Param("clubId", new ParseUUIDPipe({ version: "4" })) clubId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ClubPolicyProjection> {
    return this.policy.project(principal(request), clubId);
  }
}
