import type { IClubHub } from '@pickflick/contracts';
import type { ReactNode } from 'react';

import ActiveRatings from '../ActiveRatings/ActiveRatings';
import ActiveSessionCard from '../ActiveSessionCard/ActiveSessionCard';
import styles from './HubSessionCards.module.scss';

export default function HubSessionCards({ hub, actions }: { hub: IClubHub; actions?: ReactNode }) {
    return (
        <div className={styles.grid}>
            <ActiveSessionCard actions={actions} compact hub={hub} />
            <ActiveRatings sessions={hub.ratingSessions} />
        </div>
    );
}
