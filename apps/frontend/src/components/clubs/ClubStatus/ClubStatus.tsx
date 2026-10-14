import type { IClubAccess } from '@pickflick/contracts';

import StatusBanner from '#components/ui/StatusBanner/StatusBanner';

export default function ClubStatus({ access }: { access: IClubAccess }) {
    if (access.reasons.length === 0) return null;
    return (
        <StatusBanner label="Club status" tone="warning">
            {access.reasons.includes('ARCHIVED') ? (
                <p>
                    This Club is archived. Its Hub is read-only. History remains visible until the
                    Admin reactivates it.
                </p>
            ) : null}
            {access.adminless ? (
                <p>
                    This Club has no Admin. Every member can still view its history and leave. Owner
                    actions and new Sessions or invitations are unavailable until administration is
                    recovered.
                </p>
            ) : null}
            {access.reasons.includes('MEMBER_LIMIT') ? (
                <p>
                    This Club is over its member limit. History and existing participation remain
                    available; new Sessions and invitations are read-only until the Club fits its
                    plan.
                </p>
            ) : null}
        </StatusBanner>
    );
}
