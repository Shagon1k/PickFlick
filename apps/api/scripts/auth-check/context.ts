import { randomUUID } from 'node:crypto';

import { loadRuntimeEnvironment, type RuntimeEnvironment } from '@pickflick/config/environment';
import { assertSafeSeedOrResetTarget, createDatabaseClient } from '@pickflick/database';
import { createLogger } from '@pickflick/observability';

export const configuredEnvironment = loadRuntimeEnvironment();
if (
    configuredEnvironment.appEnvironment !== 'local' &&
    configuredEnvironment.appEnvironment !== 'test'
) {
    throw new Error(
        'The authentication integration check may run only against local or test data.',
    );
}
export const environment: RuntimeEnvironment = {
    ...configuredEnvironment,
    auth: {
        ...configuredEnvironment.auth,
        appleSignInEnabled: true,
        appleClientId: 'local-synthetic-apple-client-id',
        appleKeyId: 'SYNTHKEY1',
        applePrivateKey: 'local-synthetic-apple-private-key',
        appleTeamId: 'SYNTHTEAM1',
    },
};
assertSafeSeedOrResetTarget(environment);

export const database = createDatabaseClient(environment.databaseUrl);
export const logger = createLogger({ environment: environment.appEnvironment, service: 'api' });
export const email = `auth-check-${randomUUID()}@example.invalid`;
export const conflictEmail = `auth-check-conflict-${randomUUID()}@example.invalid`;
export const appleEmail = `auth-check-${randomUUID()}@privaterelay.appleid.com`;
export const appleLinkEmail = `auth-link-${randomUUID()}@privaterelay.appleid.com`;
export const appleOwnedEmail = `auth-owned-${randomUUID()}@privaterelay.appleid.com`;
export const authorizationCodeExchanges: string[] = [];
let syntheticClientSequence = Date.now() % 60_000;

export function nextSyntheticClientAddress(): string {
    syntheticClientSequence = (syntheticClientSequence + 1) % 60_000;
    return `198.18.${Math.floor(syntheticClientSequence / 250)}.${(syntheticClientSequence % 250) + 1}`;
}
