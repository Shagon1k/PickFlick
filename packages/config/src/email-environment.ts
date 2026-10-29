import type { z } from 'zod';

// Fixed identities: a deployment that sends from anything else is misconfigured.
const UAT_SENDER = 'PickFlick UAT <uat@pick-flick.app>';
const PRODUCTION_SENDER = 'PickFlick <notifications@pick-flick.app>';
const PRODUCTION_CONTACT = 'hello@pick-flick.app';
// Placeholder keys that make an accidental send impossible outside live mode.
const LOCAL_DISABLED_KEY = 'local-disabled';
const PREVIEW_DISABLED_KEY = 'preview-disabled';

interface IEmailEnvironment {
    APP_ENV: string;
    AUTH_BASE_URL: string;
    RESEND_FROM: string;
    RESEND_API_KEY: string;
    RESEND_DELIVERY_MODE: string;
    CONTACT_DELIVERY_TO: string;
}

export function validateEmailEnvironment(env: IEmailEnvironment, context: z.RefinementCtx) {
    const reject = (hasFailure: boolean, variable: string, message: string) => {
        if (hasFailure) context.addIssue({ code: 'custom', path: [variable], message });
    };
    const isDeployed = env.APP_ENV === 'uat' || env.APP_ENV === 'production';
    const mode = env.RESEND_DELIVERY_MODE;
    reject(
        !isDeployed && mode !== 'disabled',
        'RESEND_DELIVERY_MODE',
        'must be disabled in local or test',
    );
    reject(
        !isDeployed && env.RESEND_API_KEY !== LOCAL_DISABLED_KEY,
        'RESEND_API_KEY',
        `must be ${LOCAL_DISABLED_KEY} in local or test`,
    );
    reject(
        isDeployed && mode === 'disabled',
        'RESEND_DELIVERY_MODE',
        'may be disabled only in local or test',
    );
    reject(
        mode === 'preview' && env.APP_ENV !== 'uat',
        'RESEND_DELIVERY_MODE',
        'may be preview only in uat',
    );
    reject(
        mode === 'preview' && env.RESEND_API_KEY !== PREVIEW_DISABLED_KEY,
        'RESEND_API_KEY',
        `must be ${PREVIEW_DISABLED_KEY} in preview mode`,
    );
    reject(
        mode === 'live' && [LOCAL_DISABLED_KEY, PREVIEW_DISABLED_KEY].includes(env.RESEND_API_KEY),
        'RESEND_API_KEY',
        'must be a live environment key in live mode',
    );
    reject(
        env.APP_ENV === 'production' && mode !== 'live',
        'RESEND_DELIVERY_MODE',
        'must be live in production',
    );
    reject(
        env.APP_ENV === 'uat' && env.RESEND_FROM !== UAT_SENDER,
        'RESEND_FROM',
        `must be ${UAT_SENDER} in uat`,
    );
    reject(
        env.APP_ENV === 'production' && env.RESEND_FROM !== PRODUCTION_SENDER,
        'RESEND_FROM',
        `must be ${PRODUCTION_SENDER} in production`,
    );
    reject(
        env.APP_ENV === 'production' && env.CONTACT_DELIVERY_TO !== PRODUCTION_CONTACT,
        'CONTACT_DELIVERY_TO',
        `must be ${PRODUCTION_CONTACT} in production`,
    );
    reject(
        isDeployed && !env.AUTH_BASE_URL.startsWith('https:'),
        'AUTH_BASE_URL',
        'must use https in uat or production',
    );
}
