import styles from './LoadingState.module.scss';

export interface ILoadingStateProps {
    label: string;
    lines?: number;
    /**
     * `cards` holds a panel's card grid while a route segment streams in; `film` holds the shared
     * Movie Details and Session layout: heading, poster beside trailer, credits and synopsis.
     */
    variant?: 'lines' | 'cards' | 'film';
}

const CARD_COUNT = 4;

export default function LoadingState({ label, lines = 3, variant = 'lines' }: ILoadingStateProps) {
    if (variant === 'film') return <FilmSkeleton label={label} />;
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

function FilmSkeleton({ label }: { label: string }) {
    return (
        <div aria-busy="true" aria-live="polite" className={styles.film} role="status">
            <span className="visually-hidden">{label}</span>
            <div aria-hidden="true" className={styles.film__head}>
                <div className={styles.film__heading}>
                    <span className={styles.loadingState__title} />
                    <span className={styles.loadingState__line} />
                </div>
                <span className={styles.film__actions} />
            </div>
            <div aria-hidden="true" className={styles.film__media}>
                <span className={styles.film__poster} />
                <span className={styles.film__trailer} />
            </div>
            <div aria-hidden="true" className={styles.film__details}>
                <span className={styles.film__credits} />
                <div className={styles.film__synopsis}>
                    <span className={styles.loadingState__line} />
                    <span className={styles.loadingState__line} />
                    <span className={styles.loadingState__line} />
                </div>
            </div>
        </div>
    );
}
