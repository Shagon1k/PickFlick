'use client';

import type { IClubHub, IClubSummary } from '@pickflick/contracts';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

import ClubStatus from '#components/clubs/ClubStatus/ClubStatus';
import ProductFrame from '#components/shells/ProductFrame/ProductFrame';
import { buildClubNavigation } from '#components/shells/shell-navigation';

import styles from '../../page.module.scss';
import CallSheet from '../CallSheet/CallSheet';
import ClubSwitcher from '../ClubSwitcher/ClubSwitcher';
import { HubSnapshotContext } from '../HubPanel/HubPanel';

export default function ClubHubFrame({
    clubs,
    hub,
    children,
}: {
    clubs: IClubSummary[];
    hub: IClubHub | null;
    children: ReactNode;
}) {
    const [snapshot, setSnapshot] = useState(hub);
    const [isCreating, setIsCreating] = useState(false);
    const publish = useCallback((value: IClubHub | null) => setSnapshot(value), []);
    const pathname = usePathname();
    const current = getSection(pathname);
    const router = useRouter();
    const clubId = snapshot?.club.id;
    useEffect(() => {
        // Phones open sections from a closed bottom-bar strip, which viewport prefetching never sees;
        // the prefetched loading boundary lets every switch show its skeleton at once.
        if (clubId)
            for (const { href } of buildClubNavigation(clubId, 'overview')) router.prefetch(href);
    }, [clubId, router]);
    if (!snapshot) return <HubSnapshotContext value={publish}>{children}</HubSnapshotContext>;
    const navigation = buildClubNavigation(snapshot.club.id, current);
    return (
        <HubSnapshotContext value={publish}>
            <ProductFrame clubItems={navigation}>
                <main className={styles.hub}>
                    <div className={styles.stage} id="hub-context">
                        <ClubSwitcher
                            clubs={clubs}
                            current={snapshot.club}
                            memberCount={snapshot.memberCount}
                            sessionCount={snapshot.sessionCount}
                            onCreateChange={setIsCreating}
                        />
                        {!isCreating ? (
                            <CallSheet
                                session={snapshot.activeSession}
                                memberCount={snapshot.memberCount}
                                scheduleHref={
                                    snapshot.permissions.manageSessions
                                        ? `/clubs/${snapshot.club.id}/sessions/new`
                                        : undefined
                                }
                            />
                        ) : null}
                    </div>
                    {!isCreating ? (
                        <>
                            <ClubStatus access={snapshot.access} />
                            <nav aria-label="Club sections" className={styles.tabs}>
                                <div className={styles.tabsInner}>
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
                                </div>
                            </nav>
                            {children}
                        </>
                    ) : null}
                </main>
            </ProductFrame>
        </HubSnapshotContext>
    );
}

function getSection(
    pathname: string,
): 'overview' | 'sessions' | 'ratings' | 'members' | 'achievements' | 'manage' {
    if (pathname.endsWith('/sessions')) return 'sessions';
    if (pathname.endsWith('/ratings')) return 'ratings';
    if (pathname.endsWith('/achievements')) return 'achievements';
    if (pathname.endsWith('/members')) return 'members';
    if (pathname.endsWith('/settings')) return 'manage';
    return 'overview';
}
