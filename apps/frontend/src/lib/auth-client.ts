import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient();

export type TIdentityProvider = 'apple' | 'google';

/** Starts provider sign-in; false when Better Auth refuses to begin the flow. */
export async function startSocialSignIn(
    provider: TIdentityProvider,
    returnTo: string,
): Promise<boolean> {
    const result = await authClient.signIn.social({ provider, callbackURL: returnTo });
    return !result.error;
}
