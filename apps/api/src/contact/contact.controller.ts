import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  HttpException,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { ContactSubmissionResponse } from "@pickflick/contracts";

import { assertJsonBody } from "../common/http/json-body.js";
import { Public } from "../identity/authorization.decorators.js";
import {
  ContactConflictError,
  ContactRateLimitError,
  ContactValidationError,
} from "./contact.errors.js";
import { ContactService } from "./contact.service.js";

interface ContactHttpRequest {
  readonly headers?: Readonly<Record<string, string | string[] | undefined>>;
  readonly ip?: string;
  readonly socket?: { readonly remoteAddress?: string };
}

interface ContactHttpResponse {
  setHeader(name: string, value: string): void;
}

@Controller("contact")
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @Public()
  @HttpCode(HttpStatus.ACCEPTED)
  async submit(
    @Body() body: unknown,
    @Req() request: ContactHttpRequest,
    @Res({ passthrough: true }) response: ContactHttpResponse,
  ): Promise<ContactSubmissionResponse> {
    assertJsonBody(request);

    try {
      return await this.contactService.submit(body, request.ip ?? request.socket?.remoteAddress ?? "unknown");
    } catch (error) {
      if (error instanceof ContactValidationError) {
        throw new BadRequestException();
      }
      if (error instanceof ContactConflictError) {
        throw new ConflictException();
      }
      if (error instanceof ContactRateLimitError) {
        response.setHeader("retry-after", String(error.retryAfterSeconds));
        throw new HttpException("Too many requests.", HttpStatus.TOO_MANY_REQUESTS);
      }
      throw error;
    }
  }
}
