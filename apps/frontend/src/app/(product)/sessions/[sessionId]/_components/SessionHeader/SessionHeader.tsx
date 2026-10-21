import type { TSession } from '@pickflick/contracts';
import Link from 'next/link';
import type { ReactNode, RefObject } from 'react';

import SessionLink from '#components/sessions/SessionLink/SessionLink';
import FilmStripMenu, {
    type IFilmStripMenuProps,
} from '#components/ui/FilmStripMenu/FilmStripMenu';
import Icon from '#components/ui/Icon/Icon';
import { formatUtcDateTime } from '#lib/format';

import styles from '../../page.module.scss';

export default function SessionHeader({
    session,
    participation,
    onClosePhase,
    closePhaseLabel,
    headingRef,
    onEdit,
    onCancel,
}: {
    session: TSession;
    participation: ReactNode;
    onClosePhase?: () => void;
    closePhaseLabel: string;
    headingRef: RefObject<HTMLHeadingElement | null>;
    onEdit: () => void;
    onCancel: () => void;
}) {
    const items: IFilmStripMenuProps['items'] = [];
    if (onClosePhase)
        items.push({ id: 'next-phase', label: closePhaseLabel, onSelect: onClosePhase });
    if (session.canEdit) items.push({ id: 'edit', label: 'Edit Session', onSelect: onEdit });
    if (session.canCancel)
        items.push({ id: 'cancel', label: 'Cancel Session', danger: true, onSelect: onCancel });
    const isDecisionPhase = session.phase === 'NOMINATION' || session.phase === 'SELECTION';
    return (
        <header className={styles.header}>
            <div className={styles.headingCopy}>
                <h1 ref={headingRef} tabIndex={-1}>
                    {getHeading(session)}
                </h1>
                <p className={isDecisionPhase ? 'visually-hidden' : styles.eyebrow}>
                    Session · {SESSION_TYPES[session.type]} ·{' '}
                    <span className={styles.phase}>{session.phase.toLowerCase()}</span>
                </p>
                {session.topic && isDecisionPhase ? (
                    <p className={styles.metaLine}>
                        <Icon name="bulb" />
                        {session.topic}
                    </p>
                ) : null}
                {session.notes ? (
                    <p className={styles.metaLine}>
                        <Icon name="document" />
                        <span className={styles.notes}>{session.notes}</span>
                    </p>
                ) : null}
                {session.deadlineAt ? (
                    <p className={styles.metaLine}>
                        <Icon name="clock" />
                        Nomination closes {formatUtcDateTime(session.deadlineAt)}
                    </p>
                ) : null}
                <Link className={styles.clubContext} href={`/clubs/${session.clubId}`}>
                    ← {session.clubName}
                </Link>
            </div>
            <div className={styles.headerActions}>
                <SessionLink sessionId={session.id} compact />
                {items.length ? (
                    <FilmStripMenu
                        triggerLabel="Session settings"
                        triggerIcon="settings"
                        menuLabel="Session actions"
                        items={items}
                    />
                ) : null}
                {participation}
            </div>
        </header>
    );
}

function getHeading(session: TSession) {
    if (session.phase === 'NOMINATION') return 'Movie Nomination';
    if (session.phase === 'SELECTION') return 'Movie Selection';
    return session.topic ?? 'Untitled Session';
}

const SESSION_TYPES = {
    FULL_CYCLE: 'Full cycle',
    PRE_SELECTED: 'Pre-selected Movie',
    PAST: 'Past screening',
} as const;
