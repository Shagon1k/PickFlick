import type { IClubAccess } from '@pickflick/contracts';

import InfoTip from '#components/ui/InfoTip/InfoTip';
import StatusBanner from '#components/ui/StatusBanner/StatusBanner';

/** One line per restriction; what stays available sits in its (i). */
export default function ClubStatus({ access }: { access: IClubAccess }) {
    if (access.reasons.length === 0) return null;
    return (
        <StatusBanner label="Club status" tone="warning">
            {access.reasons.includes('ARCHIVED') ? (
                <p>
                    This Club is archived and read-only.{' '}
                    <InfoTip label="About archived Clubs">
                        History stays visible until the Admin reactivates the Club.
                    </InfoTip>
                </p>
            ) : null}
            {access.adminless ? (
                <p>
                    This Club has no Admin.{' '}
                    <InfoTip label="About Clubs without an Admin">
                        Members can still view history and leave. New Sessions and invitations wait
                        until the Club has an Admin again.
                    </InfoTip>
                </p>
            ) : null}
            {access.reasons.includes('MEMBER_LIMIT') ? (
                <p>
                    This Club is over its member limit.{' '}
                    <InfoTip label="About the member limit">
                        History and current participation stay. New Sessions and invitations wait
                        until the Club fits its plan.
                    </InfoTip>
                </p>
            ) : null}
        </StatusBanner>
    );
}
