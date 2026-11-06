import type { TSessionPhase } from '@pickflick/contracts';
import clsx from 'clsx';

import { SESSION_PHASE_LABELS } from '#components/sessions/club-session-text';
import Icon, { type TIconName } from '#components/ui/Icon/Icon';
import InfoTip from '#components/ui/InfoTip/InfoTip';

import styles from './SessionStatus.module.scss';

const PHASE_ICONS: Record<TSessionPhase, TIconName> = {
    NOMINATION: 'bulb',
    SELECTION: 'document',
    WATCHING: 'play',
    RATING: 'ratings',
    COMPLETED: 'check',
    CANCELLED: 'cancel',
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
    const status = isLogged
        ? LOGGED_STATUS
        : { label: SESSION_PHASE_LABELS[phase], icon: PHASE_ICONS[phase] };
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
