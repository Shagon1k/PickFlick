import { z } from 'zod';

export const billingEnvironmentSchema = z.object({
    STRIPE_WEBHOOK_SECRET: z
        .string()
        .trim()
        .max(8192)
        .regex(/^(?:whsec_\S+)?$/u)
        .default(''),
    STRIPE_SECRET_KEY: z.string().trim().max(8192).regex(/^\S*$/u).default(''),
    STRIPE_PRO_MONTHLY_PRICE_ID: z
        .string()
        .trim()
        .regex(/^(?:price_[a-zA-Z0-9]+)?$/u)
        .default(''),
});

export function validateBillingEnvironment(
    env: z.infer<typeof billingEnvironmentSchema> & { APP_ENV: string },
    context: z.RefinementCtx,
) {
    if (env.STRIPE_WEBHOOK_SECRET && !env.STRIPE_SECRET_KEY)
        context.addIssue({
            code: 'custom',
            path: ['STRIPE_WEBHOOK_SECRET'],
            message: 'requires billing configuration',
        });
    if (Boolean(env.STRIPE_SECRET_KEY) !== Boolean(env.STRIPE_PRO_MONTHLY_PRICE_ID))
        context.addIssue({
            code: 'custom',
            path: ['STRIPE_PRO_MONTHLY_PRICE_ID'],
            message: 'must be supplied together with STRIPE_SECRET_KEY',
        });
    if (
        env.APP_ENV !== 'production' &&
        env.STRIPE_SECRET_KEY &&
        !/^(?:sk|rk)_test_/u.test(env.STRIPE_SECRET_KEY)
    )
        context.addIssue({
            code: 'custom',
            path: ['STRIPE_SECRET_KEY'],
            message: 'must be a sandbox key outside production',
        });
}
