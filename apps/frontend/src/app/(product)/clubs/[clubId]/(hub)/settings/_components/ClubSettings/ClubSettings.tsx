'use client';

import {
    type IClubHub,
    type IClubSettings,
    type ISessionRoster,
    type TSession,
} from '@pickflick/contracts';

import ActiveSessionActions from '#app/(product)/clubs/[clubId]/_components/ActiveSessionActions/ActiveSessionActions';
import HubSessionCards from '#app/(product)/clubs/[clubId]/_components/HubSessionCards/HubSessionCards';

import styles from '../../page.module.scss';
import ClubDangerZone from './ClubDangerZone';
import ClubInfoCard from './ClubInfoCard';
import InvitationCard from './InvitationCard';
import VisibilityCard from './VisibilityCard';

export default function ClubSettings({
    projection,
    hub,
    activeSession,
}: {
    projection: IClubSettings;
    hub: IClubHub;
    activeSession: { session: TSession; roster: ISessionRoster } | null;
}) {
    const role = projection.club.membershipRole;
    return (
        <section className={styles.layout} aria-label="Manage Club">
            {role !== 'ADMIN' ? (
                <p className={styles.notice}>
                    You can review this Club&apos;s settings. Only the Club Admin can change them.
                </p>
            ) : null}

            <HubSessionCards
                hub={hub}
                actions={activeSession ? <ActiveSessionActions {...activeSession} /> : undefined}
            />
            <div className={styles.grid}>
                <ClubInfoCard projection={projection} />
                <VisibilityCard projection={projection} />
                <InvitationCard projection={projection} />
                <ClubDangerZone projection={projection} />
            </div>
        </section>
    );
}
