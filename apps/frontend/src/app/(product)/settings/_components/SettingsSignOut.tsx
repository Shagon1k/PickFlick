'use client';

import { useState } from 'react';

import Icon from '#components/ui/Icon/Icon';
import { signOutAndRedirect } from '#lib/auth-client';
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
            await signOutAndRedirect();
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
