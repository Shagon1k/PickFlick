import type { TMovieSummary } from '@pickflick/contracts';
import Image, { type StaticImageData } from 'next/image';

// Next.js declares SVG imports as any; the static image loader returns StaticImageData.
import tmdbLogo from './assets/tmdb.svg';
import styles from './SearchCredits.module.scss';

const PROVIDER_LOGO_WIDTH = 90;
const PROVIDER_LOGO_HEIGHT = 12;

export default function SearchCredits({ movies }: { movies: TMovieSummary[] }) {
    // Only TMDB's notice shows in the product; where PoiskKino and TheTVDB are credited for
    // public launch is decided in #89.
    if (!movies.some((movie) => movie.provenance.some(({ source }) => source === 'tmdb')))
        return null;
    return (
        <aside aria-label="Catalog credits" className={styles.credits}>
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
        </aside>
    );
}
