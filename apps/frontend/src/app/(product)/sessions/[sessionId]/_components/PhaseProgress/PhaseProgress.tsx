import type { ReactNode } from 'react';

import Icon from '#components/ui/Icon/Icon';

import styles from './PhaseProgress.module.scss';

export default function PhaseProgress({ children }: { children: ReactNode }) {
    return (
        <div className={styles.progress}>
            <Icon name="info" />
            <p role="status">{children}</p>
        </div>
    );
}
