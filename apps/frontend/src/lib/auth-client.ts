import { HTTP_STATUS } from '@pickflick/contracts';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();

export type TIdentityProvider = 'apple' | 'google';

/** Preserves rate-limit feedback without exposing raw provider messages. */
export async function startSocialSignIn(
    provider: TIdentityProvider,
    returnTo: string,
): Promise<'started' | 'rate-limited' | 'failed'> {
    const result = await authClient.signIn.social({ provider, callbackURL: returnTo });
    if (result.error?.status === HTTP_STATUS.TOO_MANY_REQUESTS) return 'rate-limited';
    return result.error ? 'failed' : 'started';
}
