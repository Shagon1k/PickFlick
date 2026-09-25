import styles from './LoadingState.module.scss';

export interface ILoadingStateProps {
    label: string;
    lines?: number;
}

export default function LoadingState({ label, lines = 3 }: ILoadingStateProps) {
    return (
        <div aria-busy="true" aria-live="polite" className={styles['loading-state']} role="status">
            <span className="visually-hidden">{label}</span>
            {Array.from({ length: Math.max(1, lines) }, (_, index) => (
                <span aria-hidden="true" className={styles['loading-state__line']} key={index} />
            ))}
        </div>
    );
}
