import type { z } from 'zod';

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
        !isDeployed && env.RESEND_API_KEY !== 'local-disabled',
        'RESEND_API_KEY',
        'must be local-disabled in local or test',
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
        mode === 'preview' && env.RESEND_API_KEY !== 'preview-disabled',
        'RESEND_API_KEY',
        'must be preview-disabled in preview mode',
    );
    reject(
        mode === 'live' && ['local-disabled', 'preview-disabled'].includes(env.RESEND_API_KEY),
        'RESEND_API_KEY',
        'must be a live environment key in live mode',
    );
    reject(
        env.APP_ENV === 'production' && mode !== 'live',
        'RESEND_DELIVERY_MODE',
        'must be live in production',
    );
    reject(
        env.APP_ENV === 'uat' && env.RESEND_FROM !== 'PickFlick UAT <uat@pick-flick.app>',
        'RESEND_FROM',
        'must be PickFlick UAT <uat@pick-flick.app> in uat',
    );
    reject(
        env.APP_ENV === 'production' &&
            env.RESEND_FROM !== 'PickFlick <notifications@pick-flick.app>',
        'RESEND_FROM',
        'must be PickFlick <notifications@pick-flick.app> in production',
    );
    reject(
        env.APP_ENV === 'production' && env.CONTACT_DELIVERY_TO !== 'hello@pick-flick.app',
        'CONTACT_DELIVERY_TO',
        'must be hello@pick-flick.app in production',
    );
    reject(
        isDeployed && !env.AUTH_BASE_URL.startsWith('https:'),
        'AUTH_BASE_URL',
        'must use https in uat or production',
    );
}
