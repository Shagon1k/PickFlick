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
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import type { ContactSubmissionResponse } from "@pickflick/contracts";

import {
  ContactConflictError,
  ContactRateLimitError,
  ContactService,
  ContactValidationError,
} from "./contact.service.js";

interface ContactHttpRequest {
  readonly headers?: Readonly<Record<string, string | string[] | undefined>>;
  readonly ip?: string;
  readonly socket?: { readonly remoteAddress?: string };
}

interface ContactHttpResponse {
  setHeader(name: string, value: string): void;
}

function acceptsJsonBody(request: ContactHttpRequest): boolean {
  const contentType = request.headers?.["content-type"];
  return typeof contentType === "string" && contentType.split(";", 1)[0]?.trim().toLowerCase() === "application/json";
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
    if (!acceptsJsonBody(request)) {
      throw new UnsupportedMediaTypeException();
    }

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
