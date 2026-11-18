'use client';

import type { IAccountProfile } from '@pickflick/contracts';
import { useState } from 'react';

import Button from '#components/ui/Button/Button';
import ConfirmDialog from '#components/ui/ConfirmDialog/ConfirmDialog';
import { authClient } from '#lib/auth-client';
import { getOfflineMessage } from '#lib/offline';

import { deleteAccount, prepareAccountDeletion } from '../../deletion-actions';
import styles from './AccountDeletion.module.scss';

interface IAccountDeletionProps {
    account: IAccountProfile;
    shouldConfirm: boolean;
}

const RETURN_TO = '/settings?tab=privacy&deletion=confirm';

export default function AccountDeletion({ account, shouldConfirm }: IAccountDeletionProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isPending, setIsPending] = useState(false);
    const [message, setMessage] = useState('');

    async function handleReauth(provider: string) {
        const offline = getOfflineMessage();
        if (offline) {
            setMessage(offline);
            return;
        }
        setIsPending(true);
        setMessage('');
        try {
            const prepared = await prepareAccountDeletion();
            if (!prepared.ok) {
                setMessage(prepared.message);
                return;
            }
            const result = await authClient.signIn.social({
                provider,
                callbackURL: RETURN_TO,
                additionalParams: provider === 'google' ? { prompt: 'select_account' } : undefined,
            });
            if (result.error) setMessage('Sign-in could not be started. Try again.');
        } catch {
            setMessage('Sign-in could not be started. Try again.');
        } finally {
            setIsPending(false);
        }
    }

    async function handleDelete(confirmation: string) {
        const offline = getOfflineMessage();
        if (offline) {
            setMessage(offline);
            return;
        }
        setIsPending(true);
        setMessage('');
        try {
            const result = await deleteAccount({ confirmation });
            if (!result.ok) {
                setMessage(result.message);
                return;
            }
            // Drop signed-in router caches after the server has revoked every session.
            window.location.replace('/login?account=deleted');
        } catch {
            setMessage(
                'Deletion could not be confirmed. Try again or sign in to check your account.',
            );
        } finally {
            setIsPending(false);
        }
    }

    return (
        <>
            <section className={styles.danger} aria-labelledby="deletion-heading">
                <h2 id="deletion-heading">Delete account</h2>
                <p>
                    This permanently removes your profile, personal Library, Watchlist and private
                    files. You will lose access immediately. Private-file cleanup targets 24 hours
                    after confirmation; outages can delay it. Backups and provider-held copies need
                    separate handling described in the Privacy Notice.
                </p>
                <p>
                    Shared Clubs, Sessions, nominations, ballots, ratings and comments remain with
                    the author shown as “Deleted user”. Clubs you administer will have no Admin;
                    members will be notified.
                </p>
                <p>
                    Comment text is preserved and may contain personal details. Write to{' '}
                    <a href="mailto:hello@pick-flick.app">hello@pick-flick.app</a> about those
                    details. Removing profile attribution does not guarantee irreversible anonymity.
                </p>
                <p>
                    Sign in again to the same account, then type DELETE to confirm. Signing in alone
                    does not delete anything.
                </p>
                <div className={styles.actions}>
                    {account.providers.map((provider) => (
                        <Button
                            key={provider}
                            variant="secondary-danger"
                            disabled={isPending}
                            onClick={() => {
                                void handleReauth(provider);
                            }}
                        >
                            Sign in again with {provider === 'google' ? 'Google' : 'Apple'}
                        </Button>
                    ))}
                    {shouldConfirm ? (
                        <Button
                            variant="secondary-danger"
                            disabled={isPending}
                            onClick={() => {
                                setMessage('');
                                setIsOpen(true);
                            }}
                        >
                            Delete account
                        </Button>
                    ) : null}
                </div>
                {!isOpen ? (
                    <p className={styles.feedback} role="status">
                        {message}
                    </p>
                ) : null}
            </section>
            <ConfirmDialog
                open={isOpen}
                title="Permanently delete your account?"
                word="DELETE"
                inputId="delete-account-confirmation"
                confirmLabel="Delete account"
                isPending={isPending}
                status={
                    <p className={styles.feedback} role="status">
                        {message}
                    </p>
                }
                onClose={() => setIsOpen(false)}
                onConfirm={(confirmation) => {
                    void handleDelete(confirmation);
                }}
            >
                <p>
                    You are deleting {account.email}. All sessions will end immediately. Private
                    data and files will be removed. This cannot be undone.
                </p>
                <p>
                    Your ratings and comments remain in shared history under “Deleted user”. Text
                    inside comments is preserved. Clubs you administer will have no Admin.
                </p>
            </ConfirmDialog>
        </>
    );
}
