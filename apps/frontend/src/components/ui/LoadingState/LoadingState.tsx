import type { ReactNode } from 'react';

import Skeleton from '#components/ui/Skeleton/Skeleton';

import styles from './LoadingState.module.scss';

export interface ILoadingStateProps {
    label: string;
    lines?: number;
    /** A content-shaped skeleton; without one, generic lines hold the space. */
    children?: ReactNode;
}

export default function LoadingState({ label, lines = 3, children }: ILoadingStateProps) {
    return (
        <div aria-busy="true" aria-live="polite" className={styles.loadingState} role="status">
            <span className="visually-hidden">{label}</span>
            {children ? (
                <div aria-hidden="true" inert>
                    {children}
                </div>
            ) : (
                <div className={styles.lines}>
                    {Array.from({ length: Math.max(1, lines) }, (_, index) => (
                        <div className={styles.line} key={index}>
                            <Skeleton shouldFill />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
