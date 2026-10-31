'use client';

import { resolveAuthReturnTarget, type TSessionInvitationPreview } from '@pickflick/contracts';
import { useState, useTransition } from 'react';

import styles from '#app/(auth)/invite/invite.module.scss';
import Button from '#components/ui/Button/Button';
import ButtonLink from '#components/ui/Button/ButtonLink';
import Icon from '#components/ui/Icon/Icon';
import LocalTime from '#components/ui/LocalTime/LocalTime';
import { formatCalendarDate } from '#lib/format';
import { getOfflineMessage } from '#lib/offline';
import { useIsHydrated } from '#lib/use-is-hydrated';

import { respondSessionInvitationAction } from '../../actions';

type TView = TSessionInvitationPreview | { state: 'sign-in' | 'error' | 'loading' };
const messages = {
    valid: 'Join your Club for this screening.',
    accepted: 'Your participation is confirmed.',
    declined: 'Invitation declined.',
    'sign-in': 'Sign in to review this invitation.',
    loading: 'Loading invitation…',
    error: 'We could not load this invitation. Try again shortly.',
    unavailable: 'Only members of the Club can join. Ask a member for a Club invitation.',
};
export default function Invitation({ initial, token }: { initial: TView; token: string }) {
    const [view, setView] = useState(initial);
    const [message, setMessage] = useState('');
    const [isPending, startTransition] = useTransition();
    const isReady = useIsHydrated();
    function respond(decision: 'accept' | 'decline') {
        const offlineMessage = getOfflineMessage();
        if (offlineMessage) {
            setMessage(offlineMessage);
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
    const returnPath = encodeURIComponent(resolveAuthReturnTarget(`/invite/session/${token}`));
    return (
        <div className={styles.card}>
            <div className={styles.intro}>
                <h1>Session invitation</h1>
                <p>{messages[view.state]}</p>
            </div>
            {view.state === 'valid' ? (
                <div className={styles.preview}>
                    <h2>{view.topic ?? 'Untitled Session'}</h2>
                    <p className={styles.previewMeta}>
                        <Icon name="club-building" />
                        {view.clubName}
                    </p>
                    <p className={styles.previewMeta}>
                        <Icon name="calendar" />
                        {view.scheduledAt ? formatCalendarDate(view.scheduledAt) : 'Not scheduled'}
                        {view.location ? ` · ${view.location}` : ''}
                    </p>
                    <p className={styles.previewMeta}>
                        <Icon name="profile" />
                        <span>
                            Invited by <strong>{view.inviterName}</strong> · expires{' '}
                            <LocalTime format="date" value={view.expiresAt} />
                        </span>
                    </p>
                </div>
            ) : null}
            <div className={styles.actions}>
                {view.state === 'valid' ? (
                    <>
                        <Button
                            disabled={!isReady}
                            fullWidth
                            loading={isPending}
                            size="large"
                            onClick={() => respond('accept')}
                        >
                            <Icon name="check" />
                            Accept invitation
                        </Button>
                        <Button
                            disabled={!isReady || isPending}
                            fullWidth
                            variant="ghost"
                            onClick={() => respond('decline')}
                        >
                            Decline invitation
                        </Button>
                    </>
                ) : null}
                {view.state === 'accepted' ? (
                    <ButtonLink fullWidth href={`/sessions/${view.sessionId}`} variant="primary">
                        Open Session
                    </ButtonLink>
                ) : null}
                {view.state === 'sign-in' ? (
                    <ButtonLink fullWidth href={`/login?returnTo=${returnPath}`} variant="primary">
                        Sign in
                    </ButtonLink>
                ) : null}
                {view.state === 'error' ? (
                    <Button fullWidth onClick={() => globalThis.location.reload()}>
                        Try again
                    </Button>
                ) : null}
                {!['valid', 'loading', 'sign-in', 'accepted'].includes(view.state) ? (
                    <ButtonLink fullWidth href="/app" variant="ghost">
                        Back to your Clubs
                    </ButtonLink>
                ) : null}
            </div>
            <p role="status" aria-live="polite">
                {message}
            </p>
        </div>
    );
}
