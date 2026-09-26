import type { ReactNode } from 'react';

import styles from './EmptyState.module.scss';

export interface IEmptyStateProps {
    title: string;
    children: ReactNode;
    action?: ReactNode;
}

export default function EmptyState({ action, children, title }: IEmptyStateProps) {
    return (
        <section className={styles.emptyState}>
            <span aria-hidden="true" className={styles.emptyState__sprocket}>
                <i />
                <i />
                <i />
            </span>
            <h3>{title}</h3>
            <div>{children}</div>
            {action ? <div className={styles.emptyState__action}>{action}</div> : null}
        </section>
    );
}
