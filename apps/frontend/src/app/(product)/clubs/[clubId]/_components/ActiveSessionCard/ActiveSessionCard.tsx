'use client';

import type { IClubHub } from '@pickflick/contracts';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState, useTransition } from 'react';

import { formatSessionPhase, formatSessionProgress } from '#components/sessions/club-session-text';
import { changeRosterAction } from '#components/sessions/roster-actions';
import Button from '#components/ui/Button/Button';
import ButtonLink from '#components/ui/Button/ButtonLink';
import FilmProgress from '#components/ui/FilmProgress/FilmProgress';
import { getOfflineMessage } from '#lib/offline';

import styles from './ActiveSessionCard.module.scss';

/** Overview shows the large card; Manage Club lists it among its compact 15px panels. */
export default function ActiveSessionCard({
    hub,
    isCompact = false,
    actions,
}: {
    hub: IClubHub;
    isCompact?: boolean;
    /** Contextual controls for an active Session or the empty Overview card. */
    actions?: ReactNode;
}) {
    const { activeSession: session, memberCount } = hub;
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState('');
    const router = useRouter();
    function handleJoin() {
        if (!session) return;
        const offline = getOfflineMessage();
        if (offline) {
            setMessage(offline);
            return;
        }
        startTransition(async () => {
            const result = await changeRosterAction(session.id, { action: 'join' }).catch(() => ({
                ok: false,
                message: 'Could not join this Session. Try again.',
            }));
            setMessage(result.message);
            if (result.ok) router.push(`/sessions/${session.id}`);
        });
    }
    const details = session ? (
        <div className={styles.details}>
            <p>
                Current phase:{' '}
                <strong className={styles.phase}>{formatSessionPhase(session.phase)}</strong> —{' '}
                {formatSessionProgress(session, memberCount)}
            </p>
            <FilmProgress
                value={session.progressCount ?? session.acceptedCount}
                max={
                    session.phase === 'NOMINATION' || session.progressCount === null
                        ? memberCount
                        : session.acceptedCount
                }
                label={formatSessionProgress(session, memberCount)}
            />
        </div>
    ) : null;
    const sessionAction = session?.canJoin ? (
        <Button fullWidth loading={isPending} onClick={handleJoin}>
            Join me!
        </Button>
    ) : (
        <ButtonLink fullWidth href={`/sessions/${session?.id}`} variant="primary">
            Open Session
        </ButtonLink>
    );
    return (
        <section
            className={styles.card}
            aria-label="Active Session"
            data-compact={isCompact || undefined}
        >
            <h2>Active Session</h2>
            {session ? (
                <div className={styles.stack}>
                    {details}
                    {actions ?? sessionAction}
                    <p role="status">{message}</p>
                </div>
            ) : (
                <div className={styles.stack}>
                    <p>No active Session.</p>
                    {actions}
                </div>
            )}
        </section>
    );
}
