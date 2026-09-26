import type { ReactNode } from 'react';

import styles from './Alert.module.scss';

export type TFeedbackTone = 'neutral' | 'success' | 'warning' | 'danger';

export interface IAlertProps {
    children: ReactNode;
    title?: string;
    tone?: TFeedbackTone;
}

export default function Alert({ children, title, tone = 'neutral' }: IAlertProps) {
    const urgent = tone === 'danger';
    return (
        <div
            aria-live={urgent ? 'assertive' : 'polite'}
            className={styles.alert}
            data-tone={tone}
            role={urgent ? 'alert' : 'status'}
        >
            <span aria-hidden="true" className={styles.alert__mark} />
            <span>
                {title ? <strong className={styles.alert__title}>{title}</strong> : null}
                <span className={styles.alert__body}>{children}</span>
            </span>
        </div>
    );
}
