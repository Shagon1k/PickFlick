import { z } from 'zod';

export const redisUrl = z
    .string()
    .trim()
    .refine((value) => {
        const url = URL.parse(value);
        return url && ['redis:', 'rediss:'].includes(url.protocol) && Boolean(url.hostname);
    }, 'must be a redis(s) URL with a host');

export const notificationSignalEnvironmentSchema = z
    .object({
        APP_ENV: z.enum(['local', 'test', 'uat', 'production']),
        REDIS_URL: redisUrl,
    })
    .transform((env) => ({ appEnvironment: env.APP_ENV, redisUrl: env.REDIS_URL }));
