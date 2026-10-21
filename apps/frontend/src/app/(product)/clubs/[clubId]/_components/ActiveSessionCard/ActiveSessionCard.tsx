'use client';

import { type IClubHub, type IClubHubSession, isBlockingSessionPhase } from '@pickflick/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import { changeRosterAction } from '#app/(product)/sessions/[sessionId]/roster-actions';
import Button, { getButtonClassName } from '#components/ui/Button/Button';
import ButtonLink from '#components/ui/Button/ButtonLink';
import FilmProgress from '#components/ui/FilmProgress/FilmProgress';
import { getOfflineMessage } from '#lib/offline';

import styles from './ActiveSessionCard.module.scss';

export default function ActiveSessionCard({ hub }: { hub: IClubHub }) {
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
        <div className={styles.stack}>
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
    return (
        <section className={styles.card} aria-label="Active Session">
            {session && !session.canJoin ? (
                <Link
                    className={styles.cardLink}
                    href={`/sessions/${session.id}`}
                    prefetch={false}
                    aria-label={`Open active Session: ${session.topic ?? 'Untitled Session'}`}
                >
                    <h2>Active Session</h2>
                    {details}
                    <span className={getButtonClassName('primary', 'default')}>Open Session</span>
                </Link>
            ) : (
                <>
                    <h2>Active Session</h2>
                    {session ? (
                        <div className={styles.stack}>
                            {details}
                            <Button fullWidth loading={isPending} onClick={handleJoin}>
                                Join me!
                            </Button>
                            <p role="status">{message}</p>
                        </div>
                    ) : (
                        <p>No active Session. Your next screening will appear here.</p>
                    )}
                </>
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
