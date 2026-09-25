import { createPrivateKey } from 'node:crypto';

import { isEmailAddress, isMailbox } from './environment.fields.js';
import type {
    DeploymentEnvironment,
    ResendDeliveryMode,
    ValidationFailure,
} from './environment.types.js';

export function validateStorageBucket(bucket: string, failures: ValidationFailure[]): void {
    if (
        bucket &&
        (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) ||
            bucket.includes('..') ||
            /^(?:\d{1,3}\.){3}\d{1,3}$/.test(bucket))
    ) {
        failures.push({
            name: 'STORAGE_BUCKET',
            reason: 'must be a valid lowercase S3 bucket name',
        });
    }
}

export function validateContactMailboxes(
    appEnvironment: DeploymentEnvironment,
    from: string,
    contactDeliveryTo: string,
    failures: ValidationFailure[],
): void {
    if (from && !isMailbox(from)) {
        failures.push({
            name: 'RESEND_FROM',
            reason: 'must be an email address or a name plus email address',
        });
    }
    if (appEnvironment === 'uat' && from !== 'PickFlick UAT <notifications@uat.pick-flick.app>') {
        failures.push({
            name: 'RESEND_FROM',
            reason: 'must be PickFlick UAT <notifications@uat.pick-flick.app> in uat',
        });
    }
    if (appEnvironment === 'production' && from !== 'PickFlick <notifications@pick-flick.app>') {
        failures.push({
            name: 'RESEND_FROM',
            reason: 'must be PickFlick <notifications@pick-flick.app> in production',
        });
    }
    if (contactDeliveryTo && !isEmailAddress(contactDeliveryTo)) {
        failures.push({ name: 'CONTACT_DELIVERY_TO', reason: 'must be an email address' });
    }
    if (appEnvironment === 'production' && contactDeliveryTo !== 'hello@pick-flick.app') {
        failures.push({
            name: 'CONTACT_DELIVERY_TO',
            reason: 'must be hello@pick-flick.app in production',
        });
    }
}

/** Local and test never send, UAT may preview, and production always delivers live. */
export function validateResendDelivery(
    appEnvironment: DeploymentEnvironment,
    resendDeliveryMode: ResendDeliveryMode,
    resendApiKey: string,
    failures: ValidationFailure[],
): void {
    const localOrTest = appEnvironment === 'local' || appEnvironment === 'test';
    if (localOrTest && resendDeliveryMode !== 'disabled') {
        failures.push({
            name: 'RESEND_DELIVERY_MODE',
            reason: 'must be disabled in local or test',
        });
    }
    if (localOrTest && resendApiKey !== 'local-disabled') {
        failures.push({
            name: 'RESEND_API_KEY',
            reason: 'must be local-disabled in local or test',
        });
    }
    if (resendDeliveryMode === 'disabled' && !localOrTest) {
        failures.push({
            name: 'RESEND_DELIVERY_MODE',
            reason: 'may be disabled only in local or test',
        });
    }
    if (resendDeliveryMode === 'preview' && appEnvironment !== 'uat') {
        failures.push({ name: 'RESEND_DELIVERY_MODE', reason: 'may be preview only in uat' });
    }
    if (resendDeliveryMode === 'preview' && resendApiKey !== 'preview-disabled') {
        failures.push({
            name: 'RESEND_API_KEY',
            reason: 'must be preview-disabled in preview mode',
        });
    }
    if (
        resendDeliveryMode === 'live' &&
        (resendApiKey === 'local-disabled' || resendApiKey === 'preview-disabled')
    ) {
        failures.push({
            name: 'RESEND_API_KEY',
            reason: 'must be a live environment key in live mode',
        });
    }
    if (appEnvironment === 'production' && resendDeliveryMode !== 'live') {
        failures.push({ name: 'RESEND_DELIVERY_MODE', reason: 'must be live in production' });
    }
}

export function validateApplePrivateKey(
    applePrivateKey: string,
    failures: ValidationFailure[],
): void {
    try {
        const normalizedPrivateKey = applePrivateKey.replaceAll('\\n', '\n');
        if (!normalizedPrivateKey.startsWith('-----BEGIN PRIVATE KEY-----')) {
            throw new Error('Not PKCS#8 PEM.');
        }
        const privateKey = createPrivateKey(normalizedPrivateKey);
        if (
            privateKey.asymmetricKeyType !== 'ec' ||
            privateKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1'
        ) {
            throw new Error('Not an EC P-256 key.');
        }
    } catch {
        failures.push({
            name: 'APPLE_PRIVATE_KEY',
            reason: 'must be a valid EC P-256 PKCS#8 PEM private key in uat or production',
        });
    }
}
