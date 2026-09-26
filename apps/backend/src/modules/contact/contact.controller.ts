import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { contactSubmissionSchema, type TContactSubmission } from '@pickflick/contracts';

import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { ContactService } from './contact.service.js';

@Controller('contact')
export class ContactController {
    constructor(private readonly contactService: ContactService) {}

    @Post()
    @Public()
    @HttpCode(HttpStatus.ACCEPTED)
    @Throttle({ default: { ttl: 10 * 60_000, limit: 5 } })
    submit(
        @Body(new ZodValidationPipe(contactSubmissionSchema)) submission: TContactSubmission,
    ): Promise<void> {
        return this.contactService.submit(submission);
    }
}
