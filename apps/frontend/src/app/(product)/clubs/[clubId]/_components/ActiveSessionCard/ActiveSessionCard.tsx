'use client';

import { type IClubHub, type IClubHubSession, isBlockingSessionPhase } from '@pickflick/contracts';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState, useTransition } from 'react';

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
    /** Operator controls that replace the open or join button in Manage Club. */
    actions?: ReactNode;
}) {
    const { activeSession: session, memberCount } = hub;
    const canCreate = hub.permissions.manageSessions && !isBlockingSessionPhase(session?.phase);
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
                <strong className={styles.phase}>{formatPhase(session.phase)}</strong> —{' '}
                {progressText(session, memberCount)}
            </p>
            <FilmProgress
                value={session.progressCount ?? session.acceptedCount}
                max={session.progressCount === null ? memberCount : session.acceptedCount}
                label={progressText(session, memberCount)}
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
                <p>No active Session. Your next screening will appear here.</p>
            )}
            {canCreate ? (
                <div className={styles.create}>
                    <ButtonLink href={`/clubs/${hub.club.id}/sessions/new`}>
                        Create Session
                    </ButtonLink>
                </div>
            ) : null}
        </section>
    );
}

function formatPhase(value: string) {
    return value[0] + value.slice(1).toLowerCase();
}

function progressText(session: IClubHubSession, memberCount: number) {
    if (session.phase === 'NOMINATION')
        return `${session.progressCount ?? 0} of ${session.acceptedCount} have nominated`;
    if (session.phase === 'SELECTION')
        return `${session.progressCount ?? 0} of ${session.acceptedCount} have submitted`;
    return `${session.acceptedCount} of ${memberCount} Club members have joined`;
}
