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

import {
  ContactConflictError,
  ContactRateLimitError,
  ContactService,
  ContactValidationError,
} from "./contact.service.js";

interface ContactHttpRequest {
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
  @HttpCode(HttpStatus.ACCEPTED)
  async submit(
    @Body() body: unknown,
    @Req() request: ContactHttpRequest,
    @Res({ passthrough: true }) response: ContactHttpResponse,
  ): Promise<ContactSubmissionResponse> {
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
