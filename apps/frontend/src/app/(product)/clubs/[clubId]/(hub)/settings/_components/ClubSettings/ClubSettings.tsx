'use client';

import {
    type IClubHub,
    type IClubSettings,
    type ISessionRoster,
    type TSession,
} from '@pickflick/contracts';

import ActiveSessionCard from '#app/(product)/clubs/[clubId]/_components/ActiveSessionCard/ActiveSessionCard';

import styles from '../../page.module.scss';
import ActiveRatings from '../ActiveRatings/ActiveRatings';
import type { TRatingCloseControl } from '../ActiveRatings/ActiveRatings.types';
import ActiveSessionActions from '../ActiveSessionActions/ActiveSessionActions';
import ClubDangerZone from './ClubDangerZone';
import ClubInfoCard from './ClubInfoCard';
import InvitationCard from './InvitationCard';
import VisibilityCard from './VisibilityCard';

export default function ClubSettings({
    projection,
    hub,
    activeSession,
    ratingControls,
}: {
    projection: IClubSettings;
    hub: IClubHub;
    activeSession: { session: TSession; roster: ISessionRoster } | null;
    ratingControls: TRatingCloseControl[];
}) {
    const role = projection.club.membershipRole;
    return (
        <section className={styles.layout} aria-label="Manage Club">
            {role !== 'ADMIN' ? (
                <p className={styles.notice}>
                    You can review this Club&apos;s settings. Only the Club Admin can change them.
                </p>
            ) : null}

            <div className={styles.sessionCards}>
                <ActiveSessionCard
                    actions={
                        activeSession ? <ActiveSessionActions {...activeSession} /> : undefined
                    }
                    isCompact
                    hub={hub}
                />
                <ActiveRatings sessions={hub.ratingSessions} controls={ratingControls} />
            </div>
            <div className={styles.grid}>
                <ClubInfoCard projection={projection} />
                <VisibilityCard projection={projection} />
                <InvitationCard projection={projection} />
                <ClubDangerZone projection={projection} />
            </div>
        </section>
    );
}
