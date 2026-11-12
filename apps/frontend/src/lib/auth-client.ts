import { HTTP_STATUS } from '@pickflick/contracts';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();

export type TIdentityProvider = 'apple' | 'google';

export async function signOutAndRedirect(): Promise<void> {
    const result = await authClient.signOut();
    if (result.error) throw new Error('Sign out failed. Please try again.');
    // A full load after sign-out drops every cached signed-in page.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- sign-out must clear the client router cache
    window.location.assign('/login');
}

/** Preserves rate-limit feedback without exposing raw provider messages. */
export async function startSocialSignIn(
    provider: TIdentityProvider,
    returnTo: string,
): Promise<'started' | 'rate-limited' | 'failed'> {
    const result = await authClient.signIn.social({ provider, callbackURL: returnTo });
    if (result.error?.status === HTTP_STATUS.TOO_MANY_REQUESTS) return 'rate-limited';
    return result.error ? 'failed' : 'started';
}
