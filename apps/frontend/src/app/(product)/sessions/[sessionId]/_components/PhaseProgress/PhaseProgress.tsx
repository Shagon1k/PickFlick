import type { ReactNode } from 'react';

import Icon from '#components/ui/Icon/Icon';

import styles from './PhaseProgress.module.scss';

export default function PhaseProgress({
    children,
    label,
    value,
    max,
    refreshLabel,
    disabled,
    onRefresh,
}: {
    children: ReactNode;
    label: string;
    value: number;
    max: number;
    refreshLabel: string;
    disabled: boolean;
    onRefresh: () => void;
}) {
    return (
        <div className={styles.progress}>
            <Icon name="info" />
            <p role="status">{children}</p>
            <progress aria-label={label} value={value} max={Math.max(max, 1)} />
            <button
                className={styles.refresh}
                type="button"
                aria-label={refreshLabel}
                disabled={disabled}
                onClick={onRefresh}
            >
                <Icon name="refresh" />
            </button>
        </div>
    );
}
