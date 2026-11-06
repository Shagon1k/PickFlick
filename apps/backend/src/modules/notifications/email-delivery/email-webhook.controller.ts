import {
    Controller,
    HttpCode,
    Post,
    type RawBodyRequest,
    Req,
    UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { HTTP_STATUS } from '@pickflick/contracts';
import type { Request } from 'express';

import { Public } from '../../auth/decorators/public.decorator.js';
import { EmailWebhookService } from './email-webhook.service.js';

const WEBHOOK_RATE_LIMIT = { limit: 600, ttl: 60_000 };

@Controller('webhooks/resend')
export class EmailWebhookController {
    constructor(private readonly webhooks: EmailWebhookService) {}

    @Public()
    @Post()
    @HttpCode(HTTP_STATUS.NO_CONTENT)
    @Throttle({ default: WEBHOOK_RATE_LIMIT })
    async receive(@Req() request: RawBodyRequest<Request>) {
        const id = request.get('svix-id');
        const timestamp = request.get('svix-timestamp');
        const signature = request.get('svix-signature');
        if (!id || !timestamp || !signature || !request.rawBody) throw new UnauthorizedException();
        await this.webhooks.receive(request.rawBody.toString('utf8'), { id, timestamp, signature });
    }
}
