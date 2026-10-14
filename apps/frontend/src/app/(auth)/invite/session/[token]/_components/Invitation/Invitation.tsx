'use client';

import type { TSessionInvitationPreview } from '@pickflick/contracts';
import { useState, useSyncExternalStore, useTransition } from 'react';

import Button from '@/components/ui/Button/Button';
import ButtonLink from '@/components/ui/Button/ButtonLink';
import { formatUtcDateTime, toIsoDate } from '@/lib/format';

import { respondSessionInvitationAction } from '../../actions';
import styles from '../../page.module.scss';

type TView = TSessionInvitationPreview | { state: 'sign-in' | 'error' | 'loading' };
const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;
const messages = {
    valid: 'Join your Club for this screening.',
    accepted: 'Your participation is confirmed.',
    declined: 'Invitation declined.',
    'sign-in': 'Sign in to review this invitation.',
    loading: 'Loading invitation…',
    error: 'We could not load this invitation. Try again shortly.',
    unavailable:
        'This invitation is unavailable. You must already belong to the Club. Ask the organizer for a Club invitation if you need to join.',
};
export default function Invitation({ initial, token }: { initial: TView; token: string }) {
    const [view, setView] = useState(initial);
    const [message, setMessage] = useState('');
    const [isPending, startTransition] = useTransition();
    const isReady = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
    function respond(decision: 'accept' | 'decline') {
        if (!navigator.onLine) {
            setMessage('You appear to be offline. Reconnect before responding.');
            return;
        }
        startTransition(async () => {
            try {
                const result = await respondSessionInvitationAction({ token, decision });
                if (result.state === 'error')
                    setMessage(
                        'We could not confirm your response. Check your connection and retry.',
                    );
                else {
                    setMessage('');
                    setView(result);
                }
            } catch {
                setMessage('We could not reach PickFlick. Check your connection and retry.');
            }
        });
    }
    const returnPath = encodeURIComponent(`/invite/session/${token}`);
    return (
        <div className={styles.card}>
            <div className={styles.intro}>
                <h1>Session invitation</h1>
                <p>{messages[view.state]}</p>
            </div>
            {view.state === 'valid' ? (
                <>
                    <div className={styles.preview}>
                        <h2>{view.clubName}</h2>
                        <p>{view.topic ?? 'Untitled Session'}</p>
                        <p>
                            {view.scheduledAt
                                ? formatUtcDateTime(view.scheduledAt)
                                : 'Not scheduled'}
                        </p>
                        <p>{view.location}</p>
                        <p>Invited by {view.inviterName}</p>
                        <p>Expires {toIsoDate(view.expiresAt)}</p>
                    </div>
                    <div className={styles.actions}>
                        <Button disabled={!isReady || isPending} onClick={() => respond('accept')}>
                            Accept invitation
                        </Button>
                        <Button
                            disabled={!isReady || isPending}
                            variant="secondary"
                            onClick={() => respond('decline')}
                        >
                            Decline invitation
                        </Button>
                    </div>
                </>
            ) : null}
            {view.state === 'accepted' ? (
                <ButtonLink href={`/sessions/${view.sessionId}`}>Open Session</ButtonLink>
            ) : null}
            {view.state === 'sign-in' ? (
                <ButtonLink href={`/login?returnTo=${returnPath}`}>Sign in</ButtonLink>
            ) : null}
            {!['valid', 'loading', 'sign-in', 'accepted'].includes(view.state) ? (
                <ButtonLink href="/app" variant="secondary">
                    Back to your Clubs
                </ButtonLink>
            ) : null}
            <p role="status" aria-live="polite">
                {message}
            </p>
        </div>
    );
}
