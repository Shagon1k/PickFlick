import {
    BadRequestException,
    Controller,
    HttpCode,
    Post,
    type RawBodyRequest,
    Req,
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { HTTP_STATUS } from '@pickflick/contracts';
import type { Request } from 'express';

import { Public } from '../../auth/decorators/public.decorator.js';
import { BillingProviderError, BillingWebhookError } from '../billing.types.js';
import { BillingEventsService } from './billing-events.service.js';

const WEBHOOK_RATE_LIMIT = { limit: 600, ttl: 60_000 };

@Controller('webhooks/stripe')
export class BillingWebhookController {
    constructor(private readonly events: BillingEventsService) {}

    @Public()
    @Post()
    @HttpCode(HTTP_STATUS.NO_CONTENT)
    @Throttle({ default: WEBHOOK_RATE_LIMIT })
    async receive(@Req() request: RawBodyRequest<Request>) {
        const signature = request.get('stripe-signature');
        if (!signature || !request.rawBody) throw new UnauthorizedException();
        try {
            await this.events.receive(request.rawBody, signature);
        } catch (error) {
            if (error instanceof BillingWebhookError) {
                if (error.reason === 'INVALID_SIGNATURE') throw new UnauthorizedException();
                throw new BadRequestException();
            }
            if (error instanceof BillingProviderError) throw new ServiceUnavailableException();
            throw error;
        }
    }
}
