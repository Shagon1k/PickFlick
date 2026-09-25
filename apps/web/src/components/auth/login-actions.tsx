'use client';

import { useState } from 'react';

import { Button, Icon } from '@pickflick/ui';

import { startSocialSignIn, type IdentityProvider } from './auth.service';
import styles from './login.module.css';

interface LoginActionsProps {
    readonly appleSignInEnabled: boolean;
    readonly returnTo: string;
}

export function LoginActions({ appleSignInEnabled, returnTo }: LoginActionsProps) {
    const [pendingProvider, setPendingProvider] = useState<IdentityProvider>();
    const [error, setError] = useState('');

    async function signIn(provider: IdentityProvider) {
        const providerName = provider === 'apple' ? 'Apple' : 'Google';
        setPendingProvider(provider);
        setError('');
        try {
            if (!(await startSocialSignIn(provider, returnTo))) {
                setError(`${providerName} sign-in could not be started. Please try again.`);
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
                    className={styles.oauthButton}
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
                {appleSignInEnabled ? (
                    <Button
                        className={styles.oauthButton}
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
