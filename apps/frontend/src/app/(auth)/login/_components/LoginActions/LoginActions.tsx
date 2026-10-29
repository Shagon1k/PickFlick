'use client';

import { useState } from 'react';

import Button from '#components/ui/Button/Button';
import Icon from '#components/ui/Icon/Icon';
import { startSocialSignIn, type TIdentityProvider } from '#lib/auth-client';

import styles from '../../page.module.scss';

interface ILoginActionsProps {
    readonly isAppleSignInEnabled: boolean;
    readonly returnTo: string;
}

export default function LoginActions({ isAppleSignInEnabled, returnTo }: ILoginActionsProps) {
    const [pendingProvider, setPendingProvider] = useState<TIdentityProvider>();
    const [error, setError] = useState('');

    async function signIn(provider: TIdentityProvider) {
        const providerName = provider === 'apple' ? 'Apple' : 'Google';
        setPendingProvider(provider);
        setError('');
        try {
            const result = await startSocialSignIn(provider, returnTo);
            if (result !== 'started') {
                setError(
                    result === 'rate-limited'
                        ? 'Too many sign-in attempts. Wait a minute, then try again.'
                        : `${providerName} sign-in could not be started. Please try again.`,
                );
                setPendingProvider(undefined);
            }
        } catch {
            setError(`${providerName} sign-in could not be started. Please try again.`);
            setPendingProvider(undefined);
        }
    }

    return (
        <div className={styles.actionArea}>
            <div className={styles.oauthStack}>
                <Button
                    fullWidth
                    size="large"
                    disabled={pendingProvider === 'apple'}
                    loading={pendingProvider === 'google'}
                    onClick={() => signIn('google')}
                    variant="secondary"
                >
                    <span className={styles.oauthIcon}>
                        <Icon name="google" />
                    </span>
                    Continue with Google
                </Button>
                {isAppleSignInEnabled ? (
                    <Button
                        fullWidth
                        size="large"
                        disabled={pendingProvider === 'google'}
                        loading={pendingProvider === 'apple'}
                        onClick={() => signIn('apple')}
                        variant="secondary"
                    >
                        <span className={`${styles.oauthIcon} ${styles.appleIcon}`}>
                            <Icon name="apple" />
                        </span>
                        Continue with Apple
                    </Button>
                ) : null}
            </div>
            <p
                aria-live="polite"
                className={styles.feedback}
                data-visible={Boolean(error)}
                role="status"
            >
                {error}
            </p>
        </div>
    );
}
