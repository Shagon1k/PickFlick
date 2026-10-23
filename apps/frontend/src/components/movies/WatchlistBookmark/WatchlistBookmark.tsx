import styles from './WatchlistBookmark.module.scss';

const RIBBON = 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z';

/**
 * The prototype's Watchlist ribbon on a poster's top-right corner. A placeholder until the
 * Library (Phase 15) brings Watchlist priority; it already holds its place and look.
 */
export default function WatchlistBookmark() {
    return (
        <button
            aria-label="Add to Watchlist (coming soon)"
            className={styles.bookmark}
            disabled
            type="button"
        >
            <svg aria-hidden="true" viewBox="0 0 24 24">
                <path className={styles.halo} d={RIBBON} />
                <path d={RIBBON} />
            </svg>
        </button>
    );
}
