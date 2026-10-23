'use client';

import { MOVIE_QUERY_MAX_LENGTH } from '@pickflick/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
    getNextOptionIndex,
    getSearchMessage,
    useActiveOptionVisible,
    useMovieSearch,
} from '#components/movies/movie-search';
import SearchCredits from '#components/movies/SearchCredits/SearchCredits';
import SearchPoster from '#components/movies/SearchPoster/SearchPoster';
import styles from '#components/shells/product-navigation.module.scss';
import { useOverlayDismissal, useProductOverlay } from '#components/shells/product-overlay';
import Icon from '#components/ui/Icon/Icon';

export default function ProductSearch() {
    const router = useRouter();
    const { activeOverlay, closeOverlay } = useProductOverlay();
    const isOpen = activeOverlay === 'search';
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(-1);
    const [wasOpen, setWasOpen] = useState(isOpen);
    const term = query.trim();
    const result = useMovieSearch(term, isOpen);
    const movies = result && 'data' in result ? result.data.movies : [];

    if (wasOpen !== isOpen) {
        setWasOpen(isOpen);
        if (!isOpen) {
            setQuery('');
            setActiveIndex(-1);
        }
    }

    useOverlayDismissal(isOpen, rootRef, closeOverlay, true);

    useEffect(() => {
        if (isOpen) inputRef.current?.focus({ preventScroll: true });
    }, [isOpen]);

    useActiveOptionVisible('movie-search', activeIndex);

    function handleKeyboard(event: React.KeyboardEvent<HTMLInputElement>) {
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && movies.length) {
            event.preventDefault();
            setActiveIndex((index) => getNextOptionIndex(event.key, index, movies.length));
        }
        if (event.key === 'Enter' && movies[activeIndex]) {
            event.preventDefault();
            router.push(`/movies/${movies[activeIndex].id}`);
            closeOverlay(false);
        }
    }

    const message = getSearchMessage(term, result);

    return (
        <div
            aria-label="Film search"
            className={styles.globalSearch}
            data-open={isOpen || undefined}
            id="shell-search"
            inert={!isOpen}
            ref={rootRef}
            role="search"
        >
            <div className={styles.globalSearchInner}>
                <label className="visually-hidden" htmlFor="shell-search-input">
                    Search films
                </label>
                <input
                    aria-activedescendant={
                        activeIndex >= 0 ? `movie-search-${activeIndex}` : undefined
                    }
                    aria-autocomplete="list"
                    aria-controls="movie-search-results"
                    aria-expanded={movies.length > 0}
                    autoComplete="off"
                    className={styles.globalSearchInput}
                    id="shell-search-input"
                    maxLength={MOVIE_QUERY_MAX_LENGTH}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        setActiveIndex(-1);
                    }}
                    onKeyDown={handleKeyboard}
                    placeholder="Search films…"
                    ref={inputRef}
                    role="combobox"
                    type="search"
                    value={query}
                />
                <button
                    aria-label="Close search"
                    className={styles.searchClose}
                    onClick={() => closeOverlay()}
                    type="button"
                >
                    <Icon className={styles.roundIcon} name="close" />
                </button>
                <div className={styles.searchResults} hidden={!term}>
                    <p
                        className={styles.overlayEmpty}
                        data-count={movies.length > 0 || undefined}
                        role="status"
                    >
                        {message}
                        {result?.state === 'signed-out' ? (
                            <>
                                {' '}
                                <Link href="/login">Sign in</Link>
                            </>
                        ) : null}
                    </p>
                    <div aria-label="Film results" id="movie-search-results" role="listbox">
                        {movies.map((movie, index) => (
                            <Link
                                aria-selected={activeIndex === index}
                                className={styles.searchResult}
                                href={`/movies/${movie.id}`}
                                id={`movie-search-${index}`}
                                key={movie.id}
                                onClick={() => closeOverlay(false)}
                                prefetch={false}
                                role="option"
                            >
                                <SearchPoster
                                    url={movie.posterUrl}
                                    className={styles.searchPoster}
                                />
                                <span className={styles.searchInfo}>
                                    <span className={styles.searchTitle}>
                                        {movie.title ?? movie.originalTitle ?? 'Untitled film'}
                                    </span>
                                    <span className={styles.searchMeta}>
                                        {movie.releaseYear ?? 'Year unavailable'}
                                    </span>
                                </span>
                            </Link>
                        ))}
                    </div>
                    {movies.length ? <SearchCredits movies={movies} /> : null}
                </div>
            </div>
        </div>
    );
}
