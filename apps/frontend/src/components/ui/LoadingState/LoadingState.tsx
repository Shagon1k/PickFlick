import type { IClubHub } from '@pickflick/contracts';

import Skeleton from '#components/ui/Skeleton/Skeleton';

import styles from './LoadingState.module.scss';
import PanelSkeleton, { type TPanelSkeletonVariant } from './PanelSkeleton';

export interface ILoadingStateProps {
    label: string;
    lines?: number;
    hub?: IClubHub | null;
    variant?: 'lines' | TPanelSkeletonVariant;
}

export default function LoadingState({
    label,
    lines = 3,
    variant = 'lines',
    hub,
}: ILoadingStateProps) {
    return (
        <div aria-busy="true" aria-live="polite" className={styles.loadingState} role="status">
            <span className="visually-hidden">{label}</span>
            {variant === 'lines' ? (
                <div className={styles.lines}>
                    {Array.from({ length: Math.max(1, lines) }, (_, index) => (
                        <div className={styles.line} key={index}>
                            <Skeleton shouldFill />
                        </div>
                    ))}
                </div>
            ) : (
                <div aria-hidden="true" inert>
                    <PanelSkeleton variant={variant} hub={hub} />
                </div>
            )}
        </div>
    );
}
