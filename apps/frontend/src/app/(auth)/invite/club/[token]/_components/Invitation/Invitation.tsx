'use client';

import { resolveAuthReturnTarget, type TInvitationPreview } from '@pickflick/contracts';
import { useState } from 'react';

import styles from '#app/(auth)/invite/invite.module.scss';
import Button from '#components/ui/Button/Button';
import ButtonLink from '#components/ui/Button/ButtonLink';
import Icon from '#components/ui/Icon/Icon';
import { formatCount } from '#lib/format';
import { useActionStatus } from '#lib/use-action-status';
import { useIsHydrated } from '#lib/use-is-hydrated';

import { respondInvitationAction } from '../../actions';

const RESPONSE_FAILURE = 'The invitation could not be updated. Check your connection and retry.';

type TView = TInvitationPreview | { state: 'sign-in' | 'error' | 'loading' };
/** A closed link shows as a voided ticket; the stamp names why, never which Club. */
const STAMPS: Partial<Record<TView['state'], string>> = {
    invalid: 'Void',
    used: 'Used',
    expired: 'Expired',
    revoked: 'Revoked',
    'over-limit': 'Full',
    unavailable: 'Paused',
    declined: 'Declined',
};
const messages = {
    invalid: ['Invitation unavailable', 'Ask the Club Admin for a new invitation.'],
    used: ['Invitation used', 'Someone already used this link. Ask the Club Admin for a new one.'],
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

export default function Invitation({ initial, token }: { initial: TView; token: string }) {
    const [view, setView] = useState(initial);
    // Server-rendered buttons must wait until their decision handlers are attached.
    const isReady = useIsHydrated();
    const { message: failure, setMessage, isPending, run } = useActionStatus();
    const [title, description] = messages[view.state];
    const returnTo = encodeURIComponent(resolveAuthReturnTarget(`/invite/club/${token}`));

    function respond(decision: 'accept' | 'decline') {
        run(() => respondInvitationAction({ token, decision }), {
            unreachableMessage: RESPONSE_FAILURE,
            onResult: (next) => {
                if ('ok' in next || next.state === 'error') setMessage(RESPONSE_FAILURE);
                else setView(next);
            },
        });
    }

    return (
        <div aria-busy={isPending || view.state === 'loading'} className={styles.card}>
            <div aria-live="polite" className={styles.intro}>
                <h1>{title}</h1>
                <p data-error={Boolean(failure)} role="status">
                    {failure || description}
                </p>
            </div>
            <div className={styles.preview} data-voided={STAMPS[view.state] ? true : undefined}>
                <PreviewContent view={view} />
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
                            <Icon name="check" />
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
                    <ButtonLink href="/app" variant={STAMPS[view.state] ? 'secondary' : 'ghost'}>
                        Back to your Clubs
                    </ButtonLink>
                ) : null}
            </div>
        </div>
    );
}

function PreviewContent({ view }: { view: TView }) {
    const stamp = STAMPS[view.state];
    if (stamp)
        return (
            <>
                <span className={styles.voidKicker}>Club invitation</span>
                <span className={styles.stamp}>{stamp}</span>
            </>
        );
    if (view.state !== 'valid')
        return <p>{view.state === 'loading' ? 'Please wait.' : 'Your choice stays private.'}</p>;
    return (
        <>
            <h2>{view.clubName}</h2>
            <p className={styles.previewMeta}>
                <Icon name="members" />
                {formatCount(view.memberCount, 'member')}
            </p>
            <p className={styles.previewMeta}>
                <Icon name="profile" />
                <span>
                    Invited by <strong>{view.inviterName}</strong>
                </span>
            </p>
        </>
    );
}
