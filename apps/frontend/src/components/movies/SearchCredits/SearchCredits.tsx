import type { TMovieSummary } from '@pickflick/contracts';
import Image, { type StaticImageData } from 'next/image';

// Next.js declares SVG imports as any; the static image loader returns StaticImageData.
import tmdbLogo from './assets/tmdb.svg';
import styles from './SearchCredits.module.scss';

const PROVIDER_LOGO_WIDTH = 90;
const PROVIDER_LOGO_HEIGHT = 12;

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
        <aside aria-label={label} className={styles.credits}>
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
                            width={PROVIDER_LOGO_WIDTH}
                            height={PROVIDER_LOGO_HEIGHT}
                            unoptimized
                        />
                    </a>{' '}
                    This product uses the TMDB API but is not endorsed or certified by TMDB.
                </p>
            ) : null}
        </aside>
    );
}
