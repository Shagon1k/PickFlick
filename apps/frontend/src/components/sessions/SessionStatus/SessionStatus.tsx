import type { TSessionPhase } from '@pickflick/contracts';
import clsx from 'clsx';

import Icon, { type TIconName } from '#components/ui/Icon/Icon';
import InfoTip from '#components/ui/InfoTip/InfoTip';

import styles from './SessionStatus.module.scss';

const STATUSES: Record<TSessionPhase, { label: string; icon: TIconName }> = {
    NOMINATION: { label: 'Nomination', icon: 'bulb' },
    SELECTION: { label: 'Selection', icon: 'document' },
    WATCHING: { label: 'Watching', icon: 'play' },
    RATING: { label: 'Rating', icon: 'ratings' },
    COMPLETED: { label: 'Completed', icon: 'check' },
    CANCELLED: { label: 'Cancelled', icon: 'cancel' },
};
const LOGGED_STATUS = { label: 'Logged', icon: 'clock' } as const;

/** The same phase capsule overlays phone and desktop posters, with an inline fallback. */
export default function SessionStatus({
    phase,
    isLogged = false,
    placement = 'inline',
}: {
    phase: TSessionPhase;
    isLogged?: boolean;
    placement?: 'inline' | 'poster';
}) {
    const status = isLogged ? LOGGED_STATUS : STATUSES[phase];
    return (
        <span
            className={clsx(styles.status, placement === 'poster' && styles['m-poster'])}
            data-phase={isLogged ? 'LOGGED' : phase}
        >
            <span className={styles.status__icon}>
                <Icon name={status.icon} />
            </span>
            <span className={styles.status__label}>{status.label}</span>
            {isLogged ? (
                <InfoTip label="About logged Sessions">
                    Recorded after the screening. Missing details and original submission times are
                    unknown.
                </InfoTip>
            ) : null}
        </span>
    );
}
