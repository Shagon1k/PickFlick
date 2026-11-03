import type { IClubHub } from '@pickflick/contracts';
import type { ReactNode } from 'react';

import ActiveRatings from '../ActiveRatings/ActiveRatings';
import type { TRatingCloseControl } from '../ActiveRatings/ActiveRatings.types';
import ActiveSessionCard from '../ActiveSessionCard/ActiveSessionCard';
import styles from './HubSessionCards.module.scss';

export default function HubSessionCards({
    hub,
    actions,
    ratingControls,
}: {
    hub: IClubHub;
    actions?: ReactNode;
    ratingControls: TRatingCloseControl[];
}) {
    return (
        <div className={styles.grid}>
            <ActiveSessionCard actions={actions} isCompact hub={hub} />
            <ActiveRatings sessions={hub.ratingSessions} controls={ratingControls} />
        </div>
    );
}
