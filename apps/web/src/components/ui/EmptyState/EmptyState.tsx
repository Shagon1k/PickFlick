import type { ReactNode } from 'react';

import styles from './EmptyState.module.scss';

export interface IEmptyStateProps {
    title: string;
    children: ReactNode;
    action?: ReactNode;
}

export default function EmptyState({ action, children, title }: IEmptyStateProps) {
    return (
        <section className={styles['empty-state']}>
            <span aria-hidden="true" className={styles['empty-state__sprocket']}>
                <i />
                <i />
                <i />
            </span>
            <h3>{title}</h3>
            <div>{children}</div>
            {action ? <div className={styles['empty-state__action']}>{action}</div> : null}
        </section>
    );
}
