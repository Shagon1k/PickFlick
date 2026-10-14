'use client';

import { resolveAuthReturnTarget, type TInvitationPreview } from '@pickflick/contracts';
import { useState, useSyncExternalStore } from 'react';

import Button from '@/components/ui/Button/Button';
import ButtonLink from '@/components/ui/Button/ButtonLink';

import { respondInvitationAction } from '../../actions';
import styles from '../../page.module.scss';

type TView = TInvitationPreview | { state: 'sign-in' | 'error' | 'loading' };
const messages = {
    invalid: ['Invitation unavailable', 'Ask the Club Admin for a new invitation.'],
    expired: ['Invitation expired', 'This link has expired. Ask the Club Admin for a new one.'],
    revoked: [
        'Invitation revoked',
        'This link is no longer available. Ask the Club Admin for a new one.',
    ],
    'over-limit': [
        'The Club is full',
        'No seats are available. Ask the Club Admin to check the member limit.',
    ],
    unavailable: [
        'Invitations are paused',
        'This invitation cannot be used while the Club is read-only.',
    ],
    declined: [
        'Invitation declined',
        'You have passed on this invitation. No Membership was created.',
    ],
    'sign-in': [
        'Your invitation awaits',
        'Sign in to review this invitation and choose whether to join.',
    ],
    error: [
        'Please try again',
        'The invitation could not load. Check your connection and try again.',
    ],
    loading: ['Loading invitation', 'Checking this invitation securely…'],
    valid: ['You are invited', 'One club. One screen. Infinite opinions.'],
    accepted: ['Welcome to the Club', 'Your Membership is ready. Open your screening room.'],
    'already-member': ['You are already a member', 'Open your Club to continue.'],
} as const;

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function Invitation({ initial, token }: { initial: TView; token: string }) {
    const [view, setView] = useState(initial);
    const [isPending, setIsPending] = useState(false);
    // Server-rendered buttons must wait until their decision handlers are attached.
    const isReady = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
    const [failure, setFailure] = useState('');
    const [title, description] = messages[view.state];
    const returnTo = encodeURIComponent(resolveAuthReturnTarget(`/invite/club/${token}`));

    async function respond(decision: 'accept' | 'decline') {
        setIsPending(true);
        setFailure('');
        try {
            const next = await respondInvitationAction({ token, decision });
            if (next.state === 'error') {
                setFailure('The invitation could not be updated. Check your connection and retry.');
            } else {
                setView(next);
            }
        } catch {
            setFailure('The invitation could not be updated. Check your connection and retry.');
        } finally {
            setIsPending(false);
        }
    }

    return (
        <div aria-busy={isPending || view.state === 'loading'} className={styles.card}>
            <div aria-live="polite" className={styles.intro}>
                <h1>{title}</h1>
                <p data-error={Boolean(failure)} role="status">
                    {failure || description}
                </p>
            </div>
            <div className={styles.preview}>
                {view.state === 'valid' ? (
                    <>
                        <h2>{view.clubName}</h2>
                        <p>{view.memberCount} members</p>
                        <p>
                            Invited by <strong>{view.inviterName}</strong>
                        </p>
                    </>
                ) : (
                    <p>
                        {view.state === 'loading' ? 'Please wait.' : 'Your choice stays private.'}
                    </p>
                )}
            </div>
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
                            Accept Invitation
                        </Button>
                        <Button
                            disabled={!isReady || isPending}
                            fullWidth
                            onClick={() => respond('decline')}
                            variant="ghost"
                        >
                            No thanks, I&apos;ll pass
                        </Button>
                    </>
                ) : null}
                {view.state === 'sign-in' ? (
                    <ButtonLink href={`/login?returnTo=${returnTo}`} variant="primary">
                        Sign in to continue
                    </ButtonLink>
                ) : null}
                {view.state === 'accepted' || view.state === 'already-member' ? (
                    <ButtonLink href={`/clubs/${view.clubId}`} variant="primary">
                        Open Screening Room
                    </ButtonLink>
                ) : null}
                {view.state === 'error' ? (
                    <Button fullWidth onClick={() => globalThis.location.reload()}>
                        Try again
                    </Button>
                ) : null}
                {!['valid', 'loading'].includes(view.state) ? (
                    <ButtonLink href="/app" variant="ghost">
                        Back to your Clubs
                    </ButtonLink>
                ) : null}
            </div>
        </div>
    );
}
