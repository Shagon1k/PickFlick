import type { IClubHub, IClubHubSession, IClubSummary } from '@pickflick/contracts';
import Link from 'next/link';
import type { ReactNode } from 'react';

import ClubStatus from '#components/clubs/ClubStatus/ClubStatus';
import ProductFrame from '#components/shells/ProductFrame/ProductFrame';
import { buildClubNavigation } from '#components/shells/shell-navigation';

import styles from '../../page.module.scss';
import ClubSwitcher from '../ClubSwitcher/ClubSwitcher';

export default function ClubHubFrame({
    clubs,
    hub,
    current,
    children,
}: {
    clubs: IClubSummary[];
    hub: IClubHub;
    current: 'overview' | 'members' | 'manage';
    children: ReactNode;
}) {
    const navigation = buildClubNavigation(hub.club.id, current);
    return (
        <ProductFrame clubItems={navigation}>
            <main className={styles.hub}>
                <div className={styles.stage}>
                    <ClubSwitcher clubs={clubs} current={hub.club} />
                    <CallSheet activeSession={hub.activeSession} club={hub.club} />
                </div>
                <ClubStatus access={hub.access} />
                <nav aria-label="Club sections" className={styles.tabs}>
                    {navigation.map((item) => (
                        <Link
                            aria-current={item.current ? 'page' : undefined}
                            href={item.href}
                            scroll={false}
                            key={item.label}
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>
                {children}
            </main>
        </ProductFrame>
    );
}

function formatSessionName(session: IClubHubSession): string {
    return session.topic ?? 'Untitled Session';
}

function formatSessionDate(value: string): string {
    return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeZone: 'UTC' }).format(
        new Date(value),
    );
}

function formatSessionTime(value: string): string {
    return `${new Intl.DateTimeFormat('en', { timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value))} UTC`;
}

function formatCallSheetPhase(session?: IClubHubSession): string {
    return session ? `Current phase / ${session.phase.toLowerCase()}` : 'Awaiting a Session';
}

function CallSheet({
    club,
    activeSession,
}: {
    club: IClubSummary;
    activeSession?: IClubHubSession;
}) {
    return (
        <section aria-labelledby="hub-title" className={styles.callSheet}>
            <div className={styles.callSheetHeader}>
                <span>Screening Call Sheet</span>
                <span>{formatCallSheetPhase(activeSession)}</span>
            </div>
            <div className={styles.callSheetBody}>
                <div>
                    <p className={styles.eyebrow}>
                        {club.lifecycle === 'ARCHIVED' ? 'Archived Club' : 'Now showing'}
                    </p>
                    <h1 id="hub-title">{club.name}</h1>
                    <p className={styles.description}>
                        {club.description ?? 'Your private screening room.'}
                    </p>
                    <p className={styles.clubMeta}>
                        <span>{club.tier === 'FREE' ? 'Free Club' : 'Pro Club'}</span>
                        <span>
                            Selection scale{' '}
                            <b>
                                {club.selectionScaleMin}–{club.selectionScaleMax}
                            </b>
                        </span>
                        <span>
                            {club.membershipRole === 'ADMIN' ? 'Admin' : club.membershipRole}
                        </span>
                    </p>
                    {activeSession ? (
                        <dl className={styles.callFacts}>
                            <div>
                                <dt>Session</dt>
                                <dd>{formatSessionName(activeSession)}</dd>
                            </div>
                            <div>
                                <dt>Date</dt>
                                <dd>
                                    {activeSession.scheduledAt
                                        ? formatSessionDate(activeSession.scheduledAt)
                                        : 'To be announced'}
                                </dd>
                            </div>
                            <div>
                                <dt>Call time</dt>
                                <dd>
                                    {activeSession.scheduledAt
                                        ? formatSessionTime(activeSession.scheduledAt)
                                        : 'To be announced'}
                                </dd>
                            </div>
                            <div>
                                <dt>Location</dt>
                                <dd>{activeSession.location ?? 'To be announced'}</dd>
                            </div>
                        </dl>
                    ) : (
                        <p className={styles.emptyCall}>
                            No active Session is on the Call Sheet yet.
                        </p>
                    )}
                </div>
                <div aria-hidden="true" className={styles.callArt}>
                    <span>PF</span>
                </div>
            </div>
        </section>
    );
}
