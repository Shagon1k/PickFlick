import type { ReactNode } from 'react';

import styles from '../../page.module.scss';

interface IStateCellProps {
    children: ReactNode;
    label: string;
}

export default function StateCell({ children, label }: IStateCellProps) {
    return (
        <div className={styles.stateCell}>
            <span className={styles.stateLabel}>{label}</span>
            {children}
        </div>
    );
}
