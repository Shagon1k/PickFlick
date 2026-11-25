import { Module } from '@nestjs/common';
import type { TRuntimeEnvironment } from '@pickflick/config/environment';

import { RUNTIME_ENVIRONMENT } from '../../config/runtime.module.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';
import { BILLING_PROVIDER } from './billing.types.js';
import { BillingCheckoutService } from './billing-checkout.service.js';
import { StripeBillingProvider } from './provider/stripe-billing.provider.js';
import { StubBillingProvider } from './provider/stub-billing.provider.js';

@Module({
    controllers: [BillingController],
    providers: [
        BillingService,
        BillingCheckoutService,
        {
            provide: BILLING_PROVIDER,
            inject: [RUNTIME_ENVIRONMENT],
            useFactory: ({ billing }: TRuntimeEnvironment) =>
                billing.secretKey && billing.priceId
                    ? new StripeBillingProvider(billing)
                    : new StubBillingProvider(),
        },
    ],
    exports: [BillingService],
})
export class BillingModule {}
