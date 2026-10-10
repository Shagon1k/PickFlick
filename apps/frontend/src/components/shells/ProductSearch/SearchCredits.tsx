import type { TMovieSummary } from '@pickflick/contracts';
import Image, { type StaticImageData } from 'next/image';

import styles from '@/components/shells/product-navigation.module.scss';

// Next.js declares SVG imports as any; the static image loader returns StaticImageData.
import tmdbLogo from './assets/tmdb.svg';

export default function SearchCredits({
    movies,
    label = 'Catalog credits',
}: {
    movies: TMovieSummary[];
    label?: string;
}) {
    const sources = new Set(
        movies.flatMap((movie) => movie.provenance.map(({ source }) => source)),
    );
    return (
        <aside aria-label={label} className={styles.searchCredits}>
            {sources.has('poiskkino') ? (
                <p>
                    Film data from <a href="https://poiskkino.dev/">PoiskKino</a>.
                </p>
            ) : null}
            {sources.has('thetvdb') ? (
                <p>
                    Metadata provided by <a href="https://thetvdb.com/">TheTVDB</a>.
                </p>
            ) : null}
            {sources.has('tmdb') ? (
                <p>
                    <a href="https://www.themoviedb.org">
                        <Image
                            src={tmdbLogo as StaticImageData}
                            alt="TMDB"
                            width={90}
                            height={12}
                            unoptimized
                        />
                    </a>{' '}
                    This product uses the TMDB API but is not endorsed or certified by TMDB.
                </p>
            ) : null}
        </aside>
    );
}
