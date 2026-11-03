'use client';

import type { IClubHubSession } from '@pickflick/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import SearchPoster from '#components/movies/SearchPoster/SearchPoster';
import Button from '#components/ui/Button/Button';
import ButtonLink from '#components/ui/Button/ButtonLink';
import ColorReveal from '#components/ui/ColorReveal/ColorReveal';
import Icon from '#components/ui/Icon/Icon';
import { formatAverage, formatCalendarDate, formatCount } from '#lib/format';
import { useActionStatus } from '#lib/use-action-status';

import { loadSessionHistoryAction } from './history-actions';
import styles from './HubSessions.module.scss';

export default function SessionHistory({
    clubId,
    initialSessions,
    nextCursor,
    canLogPast,
}: {
    clubId: string;
    initialSessions: IClubHubSession[];
    nextCursor: string | null;
    canLogPast: boolean;
}) {
    const router = useRouter();
    const headingRef = useRef<HTMLHeadingElement>(null);
    const { message, isSuccess, isPending, setMessage, announceSuccess, run } = useActionStatus();
    const [history, setHistory] = useState({
        initialSessions,
        initialCursor: nextCursor,
        sessions: initialSessions,
        cursor: nextCursor,
        hasLoadedMore: false,
    });
    // A live Hub refresh updates recent rows without discarding older pages the viewer loaded.
    if (history.initialSessions !== initialSessions || history.initialCursor !== nextCursor) {
        setHistory({
            ...history,
            initialSessions,
            initialCursor: nextCursor,
            sessions: history.hasLoadedMore
                ? uniqueSessions([...initialSessions, ...history.sessions])
                : initialSessions,
            cursor: history.hasLoadedMore ? history.cursor : nextCursor,
        });
    }
    function loadMore() {
        if (!history.cursor || isPending) return;
        const cursor = history.cursor;
        run(() => loadSessionHistoryAction(clubId, cursor), {
            pendingMessage: 'Loading more Sessions…',
            onResult: (result) => {
                if (!result.ok) {
                    setMessage(result.message);
                    if (result.denied) {
                        setHistory((current) => ({
                            ...current,
                            sessions: [],
                            cursor: null,
                            hasLoadedMore: false,
                        }));
                        router.refresh();
                    }
                    return;
                }
                const loadedIds = new Set(history.sessions.map(({ id }) => id));
                const added = result.page.sessions.filter(({ id }) => !loadedIds.has(id));
                setHistory((current) => ({
                    ...current,
                    sessions: uniqueSessions([...current.sessions, ...result.page.sessions]),
                    cursor: result.page.nextCursor,
                    hasLoadedMore: true,
                }));
                announceSuccess(`${formatCount(added.length, 'more Session')} loaded.`);
                requestAnimationFrame(() => {
                    const first = added[0];
                    if (first)
                        document.getElementById(`history-session-${first.id}`)?.focus({
                            preventScroll: true,
                        });
                    else headingRef.current?.focus({ preventScroll: true });
                });
            },
        });
    }
    return (
        <section aria-labelledby="session-history-heading">
            <header className={styles.heading}>
                <h2 id="session-history-heading" ref={headingRef} tabIndex={-1}>
                    History
                </h2>
                <div className={styles.historyHeadingActions}>
                    <span>{history.sessions.length} shown</span>
                    {canLogPast ? (
                        <ButtonLink
                            href={`/clubs/${clubId}/sessions/past/new?returnTo=${encodeURIComponent(`/clubs/${clubId}/sessions`)}`}
                            size="small"
                            variant="subtle"
                        >
                            <Icon name="clock" />
                            Log Past
                        </ButtonLink>
                    ) : null}
                </div>
            </header>
            {history.sessions.length ? (
                <ul className={styles.list}>
                    {history.sessions.map((session) => (
                        <li key={session.id}>
                            <Link
                                className={styles.row}
                                data-color-reveal-trigger
                                data-color-reveal-surface
                                href={`/sessions/${session.id}`}
                                id={`history-session-${session.id}`}
                                prefetch={false}
                            >
                                <ColorReveal variant="surface" />
                                <SearchPoster
                                    className={styles.poster}
                                    url={session.movie?.posterUrl ?? null}
                                    withColorReveal
                                />
                                <div className={styles.copy}>
                                    <strong>
                                        {session.movie?.title ??
                                            session.topic ??
                                            'Untitled Session'}
                                    </strong>
                                    <span>
                                        {[
                                            session.scheduledAt
                                                ? formatCalendarDate(session.scheduledAt)
                                                : 'Not scheduled',
                                            session.location,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </span>
                                    <span>{formatCount(session.acceptedCount, 'attendee')}</span>
                                </div>
                                {session.phase === 'CANCELLED' ? (
                                    <span className={styles.closedStatus}>Cancelled</span>
                                ) : (
                                    <span className={styles.score}>
                                        <ColorReveal variant="accent">
                                            {session.ratingAverage === null
                                                ? '—'
                                                : formatAverage(session.ratingAverage)}
                                        </ColorReveal>
                                    </span>
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No Session history yet.</p>
            )}
            {history.cursor ? (
                <div className={styles.loadMore}>
                    <Button loading={isPending} variant="secondary" onClick={loadMore}>
                        Load More
                    </Button>
                </div>
            ) : null}
            <p
                className={isPending || isSuccess || !message ? 'visually-hidden' : styles.feedback}
                role="status"
            >
                {message}
            </p>
        </section>
    );
}

function uniqueSessions(sessions: IClubHubSession[]) {
    const byId = new Map<string, IClubHubSession>();
    for (const session of sessions) {
        if (!byId.has(session.id)) byId.set(session.id, session);
    }
    return [...byId.values()];
}
