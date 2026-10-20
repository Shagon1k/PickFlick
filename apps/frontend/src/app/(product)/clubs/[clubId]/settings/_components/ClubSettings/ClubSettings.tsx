'use client';

import { type IClubSettings } from '@pickflick/contracts';

import styles from '../../page.module.scss';
import AvatarCard from './AvatarCard';
import ClubDangerZone from './ClubDangerZone';
import ClubInfoCard from './ClubInfoCard';
import InvitationCard from './InvitationCard';
import VisibilityCard from './VisibilityCard';

export default function ClubSettings({ projection }: { projection: IClubSettings }) {
    const role = projection.club.membershipRole;
    return (
        <section className={styles.layout} aria-label="Manage Club">
            {role !== 'ADMIN' ? (
                <p className={styles.notice}>
                    You can review this Club&apos;s settings. Only the Club Admin can change them.
                </p>
            ) : null}

            <div className={styles.grid}>
                <ClubInfoCard projection={projection} />
                <VisibilityCard projection={projection} />
                <AvatarCard projection={projection} />
                <InvitationCard projection={projection} />
                <ClubDangerZone projection={projection} />
            </div>
        </section>
    );
}
