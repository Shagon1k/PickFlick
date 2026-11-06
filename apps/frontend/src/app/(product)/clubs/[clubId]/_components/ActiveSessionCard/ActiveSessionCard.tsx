'use client';

import type { IClubHub } from '@pickflick/contracts';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import {
    formatSessionPhase,
    formatSessionProgress,
    getProgressTotal,
} from '#components/sessions/club-session-text';
import { changeRosterAction } from '#components/sessions/roster-actions';
import Button from '#components/ui/Button/Button';
import ButtonLink from '#components/ui/Button/ButtonLink';
import FilmProgress from '#components/ui/FilmProgress/FilmProgress';
import { useActionStatus } from '#lib/use-action-status';

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
    const { message, setMessage, isPending, run } = useActionStatus();
    const router = useRouter();
    function join(sessionId: string) {
        run(() => changeRosterAction(sessionId, { action: 'join' }), {
            unreachableMessage: 'Could not join this Session. Try again.',
            onResult: (result) => {
                setMessage(result.message);
                if (result.ok) router.push(`/sessions/${sessionId}`);
            },
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
                // Watching has no progress count, so its bar shows who joined out of the Club.
                max={
                    session.progressCount === null
                        ? memberCount
                        : getProgressTotal(session, memberCount)
                }
                label={formatSessionProgress(session, memberCount)}
            />
        </div>
    ) : null;
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
                    {actions ??
                        (session.canJoin ? (
                            <Button fullWidth loading={isPending} onClick={() => join(session.id)}>
                                Join me!
                            </Button>
                        ) : (
                            <ButtonLink
                                fullWidth
                                href={`/sessions/${session.id}`}
                                variant="primary"
                            >
                                Open Session
                            </ButtonLink>
                        ))}
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
