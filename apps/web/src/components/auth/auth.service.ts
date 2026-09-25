import { authClient } from './auth-client';

export type IdentityProvider = 'apple' | 'google';

export async function startSocialSignIn(
    provider: IdentityProvider,
    returnTo: string,
): Promise<boolean> {
    const result = await authClient.signIn.social({
        provider,
        callbackURL: returnTo,
    });

    return !result.error;
}
