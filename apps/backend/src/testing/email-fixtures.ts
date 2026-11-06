import type { TEmailWorkerEnvironment } from '@pickflick/config/environment';

/** A synthetic UAT worker environment for dispatcher and webhook tests; nothing is sent. */
export const EMAIL_WORKER_ENVIRONMENT: TEmailWorkerEnvironment = {
    databaseUrl: 'unused',
    baseUrl: 'https://uat.pick-flick.app',
    from: 'PickFlick UAT <uat@pick-flick.app>',
    apiKey: 'synthetic-only',
    deliveryEnabled: true,
    alertTo: 'test@pick-flick.app',
    localDelivery: null,
};
