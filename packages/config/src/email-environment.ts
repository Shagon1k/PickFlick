import { z } from 'zod';

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
    LOCAL_EMAIL_RECIPIENTS: string;
    LOCAL_EMAIL_SEND_AFTER: string;
}

export function validateEmailEnvironment(env: IEmailEnvironment, context: z.RefinementCtx) {
    const reject = (hasFailure: boolean, variable: string, message: string) => {
        if (hasFailure) context.addIssue({ code: 'custom', path: [variable], message });
    };
    const isDeployed = env.APP_ENV === 'uat' || env.APP_ENV === 'production';
    const mode = env.RESEND_DELIVERY_MODE;
    const isLocalLive = env.APP_ENV === 'local' && mode === 'live';
    reject(
        !isDeployed && !isLocalLive && mode !== 'disabled',
        'RESEND_DELIVERY_MODE',
        'must be disabled in test or local without explicit live delivery',
    );
    reject(
        !isDeployed && !isLocalLive && env.RESEND_API_KEY !== LOCAL_DISABLED_KEY,
        'RESEND_API_KEY',
        `must be ${LOCAL_DISABLED_KEY} outside live or preview delivery`,
    );
    validateLocalEmailEnvironment(env, context, isLocalLive);
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

function validateLocalEmailEnvironment(
    env: IEmailEnvironment,
    context: z.RefinementCtx,
    isLocalLive: boolean,
) {
    const reject = (hasFailure: boolean, variable: string, message: string) => {
        if (hasFailure) context.addIssue({ code: 'custom', path: [variable], message });
    };
    const recipients = env.LOCAL_EMAIL_RECIPIENTS
        ? env.LOCAL_EMAIL_RECIPIENTS.split(',').map((address) => address.trim().toLowerCase())
        : [];
    reject(
        isLocalLive &&
            (!recipients.length ||
                recipients.some((address) => !z.email().safeParse(address).success)),
        'LOCAL_EMAIL_RECIPIENTS',
        'must list the approved test accounts for local live delivery',
    );
    reject(
        isLocalLive && !z.iso.datetime().safeParse(env.LOCAL_EMAIL_SEND_AFTER).success,
        'LOCAL_EMAIL_SEND_AFTER',
        'must be an ISO timestamp marking the start of local live delivery',
    );
    reject(
        isLocalLive && !recipients.includes(env.CONTACT_DELIVERY_TO.toLowerCase()),
        'CONTACT_DELIVERY_TO',
        'must be one of LOCAL_EMAIL_RECIPIENTS in local live delivery',
    );
    reject(
        env.APP_ENV !== 'local' &&
            Boolean(env.LOCAL_EMAIL_RECIPIENTS || env.LOCAL_EMAIL_SEND_AFTER),
        'LOCAL_EMAIL_RECIPIENTS',
        'local delivery restrictions may be configured only in local',
    );
}

/** Validation above makes the scope mandatory before any local live sender starts. */
export function getLocalEmailDelivery(env: IEmailEnvironment) {
    if (env.APP_ENV !== 'local' || env.RESEND_DELIVERY_MODE !== 'live') return null;
    return {
        recipients: env.LOCAL_EMAIL_RECIPIENTS.split(',').map((address) =>
            address.trim().toLowerCase(),
        ),
        sendAfter: new Date(env.LOCAL_EMAIL_SEND_AFTER),
    };
}
