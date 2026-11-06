'use client';

import { getPosterPath, type TNominationMovie } from '@pickflick/contracts';

import SearchPoster from '#components/movies/SearchPoster/SearchPoster';
import ColorReveal from '#components/ui/ColorReveal/ColorReveal';
import HorizontalScroll from '#components/ui/HorizontalScroll/HorizontalScroll';
import InfoTip from '#components/ui/InfoTip/InfoTip';
import Skeleton from '#components/ui/Skeleton/Skeleton';
import { formatMovieTitle } from '#lib/format';

import styles from './Nomination.module.scss';

export default function NominationSuggestions({
    past,
    watchlist,
    disabled,
    onChoose,
    isLoading = false,
}: {
    past: TNominationMovie[];
    watchlist: TNominationMovie[];
    disabled: boolean;
    onChoose: (movie: TNominationMovie) => void;
    isLoading?: boolean;
}) {
    return (
        <div className={styles.suggestionColumns}>
            <SuggestionList
                title="Try again"
                explanation="Films you nominated in earlier Sessions of this Club that were not selected."
                emptyMessage="No earlier picks."
                movies={past}
                disabled={disabled}
                onChoose={onChoose}
                isLoading={isLoading}
            />
            <SuggestionList
                title="Watchlist"
                explanation="Your saved films, ordered from High to Low priority. Choose a film, then use the arrow in the field to nominate it."
                emptyMessage="Your Watchlist is empty."
                movies={watchlist}
                disabled={disabled}
                onChoose={onChoose}
                isLoading={isLoading}
            />
        </div>
    );
}

function SuggestionList({
    title,
    explanation,
    emptyMessage,
    movies,
    disabled,
    onChoose,
    isLoading,
}: {
    title: string;
    explanation: string;
    emptyMessage: string;
    movies: TNominationMovie[];
    disabled: boolean;
    onChoose: (movie: TNominationMovie) => void;
    isLoading: boolean;
}) {
    return (
        <section className={styles.suggestionSection} aria-label={`${title} suggestions`}>
            <header className={styles.suggestionHeading}>
                <h3>{title}</h3>
                <InfoTip label={`About ${title}`}>{explanation}</InfoTip>
            </header>
            {movies.length ? (
                <HorizontalScroll label={`${title} suggestions`} variant="plain">
                    <ul className={styles.suggestions}>
                        {movies.map((movie) => {
                            const movieTitle = formatMovieTitle(movie);
                            return (
                                <li key={movie.id}>
                                    <button
                                        className={styles.suggestion}
                                        aria-label={[
                                            'Select',
                                            movieTitle,
                                            movie.year ? `(${movie.year})` : '',
                                        ]
                                            .filter(Boolean)
                                            .join(' ')}
                                        data-color-reveal-trigger
                                        data-color-reveal-surface
                                        disabled={disabled}
                                        onClick={() => onChoose(movie)}
                                        type="button"
                                    >
                                        <ColorReveal variant="surface" />
                                        <SearchPoster
                                            className={styles.suggestionPoster}
                                            url={getPosterPath(movie.id)}
                                            withColorReveal
                                            isLoading={isLoading}
                                        />
                                        <strong>
                                            {isLoading ? (
                                                <Skeleton text={movieTitle} />
                                            ) : (
                                                movieTitle
                                            )}
                                        </strong>
                                        {movie.year ? (
                                            <span className={styles.suggestionYear}>
                                                {isLoading ? (
                                                    <Skeleton text={movie.year} />
                                                ) : (
                                                    movie.year
                                                )}
                                            </span>
                                        ) : null}
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </HorizontalScroll>
            ) : (
                <p>{emptyMessage}</p>
            )}
        </section>
    );
}
