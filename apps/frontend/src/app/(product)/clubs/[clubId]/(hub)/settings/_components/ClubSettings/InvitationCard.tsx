'use client';

import { CLUB_INVITATION_LIFETIME_HOURS, type IClubSettings } from '@pickflick/contracts';

import InviteDialog from '#components/clubs/InviteDialog/InviteDialog';
import Button from '#components/ui/Button/Button';
import InfoTip from '#components/ui/InfoTip/InfoTip';

import styles from '../../page.module.scss';
import ManageModerators from './ManageModerators';

/** The Members card: invitation links live in a dialog so the card stays one row of actions. */
export default function InvitationCard({ projection }: { projection: IClubSettings }) {
    const isAllowed = projection.permissions.manageMembers;
    const canManageRoles =
        projection.club.membershipRole === 'ADMIN' && projection.club.lifecycle === 'ACTIVE';
    return (
        <section aria-labelledby="club-members-title" className={styles.card}>
            <div className={styles.cardTitle}>
                <h2 id="club-members-title">Members</h2>
                <InfoTip label="About invitations">
                    Each invitation link admits one person and expires after{' '}
                    {CLUB_INVITATION_LIFETIME_HOURS} hours.
                </InfoTip>
            </div>
            <p className={styles.cardLead}>
                {projection.members.length} of {projection.entitlements.memberLimit} member places
                in use.
                {isAllowed ? null : ' Invitations need an active Club and an Admin or Moderator.'}
            </p>
            {isAllowed || canManageRoles ? (
                <div className={styles.cardActions}>
                    {isAllowed ? (
                        <InviteDialog
                            projection={projection}
                            trigger={(onOpen) => (
                                <Button onClick={onOpen} size="small">
                                    Invite members
                                </Button>
                            )}
                        />
                    ) : null}
                    {canManageRoles ? <ManageModerators projection={projection} /> : null}
                </div>
            ) : null}
        </section>
    );
}
