import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  StreamableFile,
  UnsupportedMediaTypeException,
  Put,
} from "@nestjs/common";
import type {
  ClubAvatarResponse,
  ClubCollectionResponse,
  ClubOperationReceipt,
  ClubPolicyProjection,
  ClubSettingsProjection,
  CreateClubResponse,
  UpdateClubSettingsResponse,
} from "@pickflick/contracts";

import {
  AUTHENTICATED_PRINCIPAL,
  type AuthenticatedRequest,
} from "../identity/authorization.types.js";
import { ClubAuthorizationError, ClubConflictError, ClubValidationError } from "./club.errors.js";
import { ClubManagementService } from "./club-management.service.js";
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

async function command<T>(callback: () => Promise<T>): Promise<T> {
  try {
    return await callback();
  } catch (error) {
    if (error instanceof ClubValidationError) {
      throw new BadRequestException();
    }
    if (error instanceof ClubAuthorizationError) {
      throw new ForbiddenException();
    }
    if (error instanceof ClubConflictError) {
      throw new ConflictException();
    }
    throw error;
  }
}

@Controller("clubs")
export class ClubsController {
  constructor(
    private readonly onboarding: ClubOnboardingService,
    private readonly policy: ClubPolicyService,
    private readonly management: ClubManagementService,
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

  @Get(":clubId/settings")
  @Header("Cache-Control", "private, no-store")
  async projectSettings(
    @Param("clubId", new ParseUUIDPipe({ version: "4" })) clubId: string,
    @Req() request: AuthenticatedRequest,
  ): Promise<ClubSettingsProjection> {
    return this.management.project(principal(request), clubId);
  }

  @Patch(":clubId/settings")
  @Header("Cache-Control", "private, no-store")
  async updateSettings(
    @Param("clubId", new ParseUUIDPipe({ version: "4" })) clubId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<UpdateClubSettingsResponse> {
    if (!acceptsJsonBody(request)) {
      throw new UnsupportedMediaTypeException();
    }
    return command(() => this.management.updateSettings(principal(request), clubId, body));
  }

  @Patch(":clubId/members/:membershipId/role")
  @Header("Cache-Control", "private, no-store")
  async changeMemberRole(
    @Param("clubId", new ParseUUIDPipe({ version: "4" })) clubId: string,
    @Param("membershipId", new ParseUUIDPipe({ version: "4" })) membershipId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<ClubOperationReceipt> {
    if (!acceptsJsonBody(request)) {
      throw new UnsupportedMediaTypeException();
    }
    return command(() => this.management.changeMemberRole(principal(request), clubId, membershipId, body));
  }

  @Post(":clubId/archive")
  @Header("Cache-Control", "private, no-store")
  async archive(
    @Param("clubId", new ParseUUIDPipe({ version: "4" })) clubId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<ClubOperationReceipt> {
    if (!acceptsJsonBody(request)) {
      throw new UnsupportedMediaTypeException();
    }
    return command(() => this.management.changeLifecycle(principal(request), clubId, "archive", body));
  }

  @Post(":clubId/reactivate")
  @Header("Cache-Control", "private, no-store")
  async reactivate(
    @Param("clubId", new ParseUUIDPipe({ version: "4" })) clubId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<ClubOperationReceipt> {
    if (!acceptsJsonBody(request)) {
      throw new UnsupportedMediaTypeException();
    }
    return command(() => this.management.changeLifecycle(principal(request), clubId, "reactivate", body));
  }

  @Post(":clubId/leave")
  @Header("Cache-Control", "private, no-store")
  async leave(
    @Param("clubId", new ParseUUIDPipe({ version: "4" })) clubId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<ClubOperationReceipt> {
    if (!acceptsJsonBody(request)) {
      throw new UnsupportedMediaTypeException();
    }
    return command(() => this.management.leave(principal(request), clubId, body));
  }

  @Post(":clubId/delete")
  @Header("Cache-Control", "private, no-store")
  async delete(
    @Param("clubId", new ParseUUIDPipe({ version: "4" })) clubId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<ClubOperationReceipt> {
    if (!acceptsJsonBody(request)) {
      throw new UnsupportedMediaTypeException();
    }
    return command(() => this.management.delete(principal(request), clubId, body));
  }

  @Put(":clubId/avatar")
  @Header("Cache-Control", "private, no-store")
  async putAvatar(
    @Param("clubId", new ParseUUIDPipe({ version: "4" })) clubId: string,
    @Headers("x-operation-id") operationId: string | undefined,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<ClubAvatarResponse> {
    const contentType = typeof request.headers["content-type"] === "string"
      ? request.headers["content-type"]
      : undefined;
    if (!contentType?.toLowerCase().startsWith("image/")) {
      throw new UnsupportedMediaTypeException();
    }
    return command(() => this.management.putAvatar(principal(request), clubId, operationId, body, contentType));
  }

  @Delete(":clubId/avatar")
  @Header("Cache-Control", "private, no-store")
  async removeAvatar(
    @Param("clubId", new ParseUUIDPipe({ version: "4" })) clubId: string,
    @Body() body: unknown,
    @Req() request: AuthenticatedRequest,
  ): Promise<ClubAvatarResponse> {
    if (!acceptsJsonBody(request)) {
      throw new UnsupportedMediaTypeException();
    }
    return command(() => this.management.removeAvatar(principal(request), clubId, body));
  }

  @Get(":clubId/avatar")
  @Header("Cache-Control", "private, no-store")
  async getAvatar(
    @Param("clubId", new ParseUUIDPipe({ version: "4" })) clubId: string,
    @Req() request: AuthenticatedRequest,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void },
  ): Promise<StreamableFile> {
    const avatar = await this.management.getAvatar(principal(request), clubId);
    response.setHeader("Content-Type", avatar.contentType);
    response.setHeader("X-Content-Type-Options", "nosniff");
    return new StreamableFile(avatar.body);
  }
}
