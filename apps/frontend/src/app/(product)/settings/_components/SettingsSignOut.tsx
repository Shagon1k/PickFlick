'use client';

import { useState } from 'react';

import Icon from '#components/ui/Icon/Icon';
import { authClient } from '#lib/auth-client';
import { getOfflineMessage } from '#lib/offline';

import styles from '../page.module.scss';

export default function SettingsSignOut() {
    const [isPending, setIsPending] = useState(false);
    const [message, setMessage] = useState('');
    async function handleSignOut() {
        const offline = getOfflineMessage();
        if (offline) {
            setMessage(offline);
            return;
        }
        setIsPending(true);
        try {
            const result = await authClient.signOut();
            if (result.error) {
                setMessage('Sign out failed. Please try again.');
                setIsPending(false);
                return;
            }
            // Drop cached authenticated pages with the signed-out document load.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- sign-out must clear the client router cache
            window.location.assign('/login');
        } catch {
            setMessage('Sign out failed. Please try again.');
            setIsPending(false);
        }
    }
    return (
        <div className={styles.settings__signout}>
            <button
                type="button"
                disabled={isPending}
                onClick={() => {
                    void handleSignOut();
                }}
            >
                <Icon name="sign-out" />
                Sign out
            </button>
            <p hidden={!message} role="status">
                {message}
            </p>
        </div>
    );
}
