import styles from './LoadingState.module.scss';

export interface ILoadingStateProps {
    label: string;
    lines?: number;
    /** `cards` holds a panel's card grid while a route segment streams in. */
    variant?: 'lines' | 'cards';
}

const CARD_COUNT = 4;

export default function LoadingState({ label, lines = 3, variant = 'lines' }: ILoadingStateProps) {
    if (variant === 'cards')
        return (
            <div
                aria-busy="true"
                aria-live="polite"
                className={styles.loadingState__cards}
                role="status"
            >
                <span className="visually-hidden">{label}</span>
                {Array.from({ length: CARD_COUNT }, (_, index) => (
                    <div aria-hidden="true" className={styles.loadingState__card} key={index}>
                        <span className={styles.loadingState__title} />
                        <span className={styles.loadingState__line} />
                        <span className={styles.loadingState__line} />
                    </div>
                ))}
            </div>
        );
    return (
        <div aria-busy="true" aria-live="polite" className={styles.loadingState} role="status">
            <span className="visually-hidden">{label}</span>
            {Array.from({ length: Math.max(1, lines) }, (_, index) => (
                <span aria-hidden="true" className={styles.loadingState__line} key={index} />
            ))}
        </div>
    );
}
