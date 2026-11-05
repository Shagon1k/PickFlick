'use client';

import type { IClubHub, IClubSummary } from '@pickflick/contracts';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';

import ClubStatus from '#components/clubs/ClubStatus/ClubStatus';
import ProductFrame from '#components/shells/ProductFrame/ProductFrame';
import SectionTabs from '#components/shells/SectionTabs/SectionTabs';
import { buildClubNavigation, getHubSection } from '#components/shells/shell-navigation';

import styles from '../../page.module.scss';
import CallSheet from '../CallSheet/CallSheet';
import ClubSwitcher from '../ClubSwitcher/ClubSwitcher';
import HubLiveRefresh from '../HubLiveRefresh/HubLiveRefresh';
import { HubSnapshotContext, PublishHubContext } from '../HubPanel/HubPanel';

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
    const pathname = usePathname();
    const current = getHubSection(pathname);
    const router = useRouter();
    const clubId = snapshot?.club.id;
    useEffect(() => {
        // Phones open sections from a closed bottom-bar strip, which viewport prefetching never sees;
        // the prefetched loading boundary lets every switch show its skeleton at once.
        if (clubId)
            for (const { href } of buildClubNavigation(clubId, 'overview')) router.prefetch(href);
    }, [clubId, router]);
    if (!snapshot) {
        return (
            <PublishHubContext value={setSnapshot}>
                <ProductFrame>
                    <main>{children}</main>
                </ProductFrame>
            </PublishHubContext>
        );
    }
    const navigation = buildClubNavigation(snapshot.club.id, current);
    return (
        <PublishHubContext value={setSnapshot}>
            <ProductFrame clubItems={navigation}>
                <main className={styles.hub}>
                    <HubLiveRefresh />
                    <div className={styles.stage} id="hub-context">
                        <ClubSwitcher
                            clubs={clubs}
                            current={snapshot.club}
                            memberCount={snapshot.memberCount}
                            sessionCount={snapshot.sessionCount}
                            isCreating={isCreating}
                            onCreateChange={setIsCreating}
                        />
                        {!isCreating ? (
                            <CallSheet
                                session={snapshot.activeSession}
                                memberCount={snapshot.memberCount}
                                scheduleHref={
                                    snapshot.permissions.manageSessions
                                        ? `/clubs/${snapshot.club.id}/sessions/new?returnTo=${encodeURIComponent(pathname)}`
                                        : undefined
                                }
                            />
                        ) : null}
                    </div>
                    {!isCreating ? (
                        <>
                            <ClubStatus access={snapshot.access} />
                            <SectionTabs items={navigation} label="Club sections">
                                <HubSnapshotContext value={snapshot}>{children}</HubSnapshotContext>
                            </SectionTabs>
                        </>
                    ) : null}
                </main>
            </ProductFrame>
        </PublishHubContext>
    );
}
