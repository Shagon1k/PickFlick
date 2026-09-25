import { Logger } from '@nestjs/common';

import type { IEmailClient, IEmailMessage } from './email.types.js';

/** Used when delivery is disabled (local, test, UAT preview): records that an email would go out. */
export class LoggingEmailClient implements IEmailClient {
    private readonly logger = new Logger(LoggingEmailClient.name);

    async send(message: IEmailMessage): Promise<void> {
        this.logger.log(`Email delivery disabled; skipped "${message.subject}".`);
    }
}
