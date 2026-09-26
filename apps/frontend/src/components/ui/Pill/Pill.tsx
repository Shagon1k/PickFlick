import type { ReactNode } from 'react';

import styles from './Pill.module.scss';

export interface IPillProps {
    children: ReactNode;
    tone?: 'neutral' | 'warm' | 'success' | 'warning' | 'danger';
}

export default function Pill({ children, tone = 'neutral' }: IPillProps) {
    return (
        <span className={styles.pill} data-tone={tone}>
            {children}
        </span>
    );
}
