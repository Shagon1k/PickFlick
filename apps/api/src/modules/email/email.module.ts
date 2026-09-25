import { Module } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';
import { EMAIL_CLIENT } from './email.types.js';
import { LoggingEmailClient } from './logging-email.client.js';
import { ResendEmailClient } from './resend-email.client.js';

@Module({
    providers: [
        {
            provide: EMAIL_CLIENT,
            inject: [RUNTIME_ENVIRONMENT],
            useFactory: ({ resend }: TRuntimeEnvironment) =>
                resend.deliveryEnabled
                    ? new ResendEmailClient(resend.apiKey, resend.from)
                    : new LoggingEmailClient(),
        },
    ],
    exports: [EMAIL_CLIENT],
})
export class EmailModule {}
