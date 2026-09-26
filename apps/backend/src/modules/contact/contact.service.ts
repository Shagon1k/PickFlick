import { Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';
import type { TContactSubmission } from '@pickflick/contracts';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';
import { EMAIL_CLIENT, type IEmailClient } from '../email/email.types.js';

@Injectable()
export class ContactService {
    private readonly logger = new Logger(ContactService.name);

    constructor(
        @Inject(RUNTIME_ENVIRONMENT) private readonly environment: TRuntimeEnvironment,
        @Inject(EMAIL_CLIENT) private readonly email: IEmailClient,
    ) {}

    async submit(submission: TContactSubmission): Promise<void> {
        try {
            await this.email.send({
                to: this.environment.contact.deliveryTo,
                subject: 'PickFlick contact message',
                text: [
                    `Name: ${submission.name ?? 'Not provided'}`,
                    `Email: ${submission.email ?? 'Not provided'}`,
                    '',
                    submission.message,
                ].join('\n'),
                ...(submission.email ? { replyTo: submission.email } : {}),
            });
        } catch (error) {
            // Nothing is stored; the visitor keeps their text and retries.
            this.logger.error(
                `Contact email failed: ${error instanceof Error ? error.message : error}`,
            );
            throw new ServiceUnavailableException();
        }
    }
}
