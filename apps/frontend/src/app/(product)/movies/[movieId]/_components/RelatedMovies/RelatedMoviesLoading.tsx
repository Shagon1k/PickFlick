import MoviePoster from '#components/movies/MoviePoster/MoviePoster';
import Skeleton from '#components/ui/Skeleton/Skeleton';

import styles from '../../page.module.scss';

export default function RelatedMoviesLoading({ count }: { count: number }) {
    return (
        <div role="status" aria-busy="true">
            <span className="visually-hidden">Loading related films…</span>
            <div className={styles.relatedGrid} aria-hidden="true" inert>
                {Array.from({ length: count }, (_, index) => (
                    <div className={styles.relatedCard} key={index}>
                        <MoviePoster
                            isLoading
                            className={styles.relatedPoster}
                            url={null}
                            title=""
                        />
                        <strong>
                            <Skeleton text="Film title" />
                        </strong>
                        <span>
                            <Skeleton text="Year" />
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}
