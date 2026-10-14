import type { ReactNode } from 'react';

import type { TFeedbackTone } from '#components/ui/Alert/Alert';

import styles from './StatusBanner.module.scss';

export interface IStatusBannerProps {
    children: ReactNode;
    label?: string;
    tone?: TFeedbackTone;
}

export default function StatusBanner({
    children,
    label = 'Session status',
    tone = 'neutral',
}: IStatusBannerProps) {
    return (
        <section aria-label={label} className={styles.statusBanner} data-tone={tone}>
            <span aria-hidden="true" className={styles.statusBanner__icon}>
                i
            </span>
            <span>{children}</span>
        </section>
    );
}
