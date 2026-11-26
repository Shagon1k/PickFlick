import 'reflect-metadata';

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { loadRuntimeEnvironment } from '@pickflick/config/environment';
import { assertSafeSeedOrResetTarget } from '@pickflick/database';

import { AppModule } from '../app.module.js';
import { configureApplication } from '../config/configure-application.js';
import { BILLING_PROVIDER, type IBillingProvider } from '../modules/billing/billing.types.js';
import { StubBillingProvider } from '../modules/billing/provider/stub-billing.provider.js';

const PERIOD_MS = 30 * 86400_000;

/** Simulates hosted payment completion; production bootstrap never imports this test entrypoint. */
class JourneyBillingProvider extends StubBillingProvider {
    override async createCheckoutSession(
        input: Parameters<IBillingProvider['createCheckoutSession']>[0],
    ) {
        const checkout = await super.createCheckoutSession(input);
        const id = `subscription_${checkout.id}`;
        this.subscriptions.set(id, {
            id,
            customerId: input.customerId,
            priceId: 'price_journey',
            status: 'ACTIVE',
            periodStart: new Date(),
            periodEnd: new Date(Date.now() + PERIOD_MS),
            paidThrough: new Date(Date.now() + PERIOD_MS),
            cancelAtPeriodEnd: false,
        });
        this.checkouts.set(checkout.id, {
            ...checkout,
            status: 'complete',
            subscriptionId: id,
            url: null,
        });
        return checkout;
    }
}

const environment = loadRuntimeEnvironment();
if (environment.appEnvironment !== 'test')
    throw new Error('The journey API requires APP_ENV=test.');
assertSafeSeedOrResetTarget(environment);
const moduleRef = await Test.createTestingModule({ imports: [AppModule.register(environment)] })
    .overrideProvider(BILLING_PROVIDER)
    .useValue(new JourneyBillingProvider(true))
    .compile();
const app = moduleRef.createNestApplication<NestExpressApplication>({
    bodyParser: false,
    rawBody: true,
    logger: false,
});
configureApplication(app);
app.enableShutdownHooks();
await app.listen(environment.backendPort, environment.backendHost);
