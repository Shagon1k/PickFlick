import { authClient } from '@/lib/auth-client';

export type TIdentityProvider = 'apple' | 'google';

export async function startSocialSignIn(
    provider: TIdentityProvider,
    returnTo: string,
): Promise<boolean> {
    const result = await authClient.signIn.social({
        provider,
        callbackURL: returnTo,
    });

    return !result.error;
}
