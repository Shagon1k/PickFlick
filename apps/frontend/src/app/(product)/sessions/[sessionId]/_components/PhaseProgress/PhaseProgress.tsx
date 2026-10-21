import type { ReactNode } from 'react';

import Icon from '#components/ui/Icon/Icon';

import styles from './PhaseProgress.module.scss';

export default function PhaseProgress({
    children,
    refreshLabel,
    disabled,
    onRefresh,
}: {
    children: ReactNode;
    refreshLabel?: string;
    disabled?: boolean;
    onRefresh?: () => void;
}) {
    return (
        <div className={styles.progress}>
            <Icon name="info" />
            <p role="status">{children}</p>
            {onRefresh ? (
                <button
                    className={styles.refresh}
                    type="button"
                    aria-label={refreshLabel}
                    disabled={disabled}
                    onClick={onRefresh}
                >
                    <Icon name="refresh" />
                </button>
            ) : null}
        </div>
    );
}
