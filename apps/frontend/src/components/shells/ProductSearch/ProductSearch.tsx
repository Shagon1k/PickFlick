'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import styles from '@/components/shells/product-navigation.module.scss';
import { useOverlayDismissal, useProductOverlay } from '@/components/shells/product-overlay';
import Icon from '@/components/ui/Icon/Icon';

import { searchMoviesAction } from './actions';
import SearchCredits from './SearchCredits';

type TSearchResponse = Awaited<ReturnType<typeof searchMoviesAction>>;

function searchMessage(term: string, result: TSearchResponse | null): string {
    if (!term) return '';
    if (!result) return 'Searching films…';
    if (result.state === 'signed-out') return 'Your session has ended. Sign in to search films.';
    if (result.state === 'invalid') return 'Use a film title of 1–200 characters.';
    if (result.state === 'error') return 'Film search is temporarily unavailable. Try again.';
    if (result.state === 'unavailable') {
        if (result.reason === 'DISABLED') return 'Film search is not configured yet.';
        if (result.reason === 'RATE_LIMITED')
            return 'Film search is busy. Please try again shortly.';
        return 'The film provider is temporarily unavailable. Try again.';
    }
    if (result.state === 'stale')
        return 'Showing cached results while the provider is unavailable.';
    if (!result.data.movies.length) return 'No films found. Try another title.';
    return `${result.data.movies.length} films found.`;
}

export default function ProductSearch() {
    const router = useRouter();
    const { activeOverlay, closeOverlay } = useProductOverlay();
    const open = activeOverlay === 'search';
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState<{ query: string; result: TSearchResponse } | null>(
        null,
    );
    const [activeIndex, setActiveIndex] = useState(-1);
    const [wasOpen, setWasOpen] = useState(open);
    const term = query.trim();
    const result = response?.query === term ? response.result : null;
    const movies = result && 'data' in result ? result.data.movies : [];

    if (wasOpen !== open) {
        setWasOpen(open);
        if (!open) {
            setQuery('');
            setResponse(null);
            setActiveIndex(-1);
        }
    }

    useOverlayDismissal(open, rootRef, closeOverlay, true);

    useEffect(() => {
        if (open) inputRef.current?.focus({ preventScroll: true });
    }, [open]);

    useEffect(() => {
        if (!open || !term) return;
        let cancelled = false;
        const timer = setTimeout(() => {
            void searchMoviesAction(term).then(
                (result) => {
                    if (!cancelled) setResponse({ query: term, result });
                },
                () => {
                    if (!cancelled) setResponse({ query: term, result: { state: 'error' } });
                },
            );
        }, 300);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [open, term]);

    useEffect(() => {
        if (activeIndex >= 0)
            document
                .getElementById(`movie-search-${activeIndex}`)
                ?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex]);

    function handleKeyboard(event: React.KeyboardEvent<HTMLInputElement>) {
        if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && movies.length) {
            event.preventDefault();
            setActiveIndex((index) => {
                if (event.key === 'ArrowDown') return (index + 1) % movies.length;
                if (index < 0) return movies.length - 1;
                return (index - 1 + movies.length) % movies.length;
            });
        }
        if (event.key === 'Enter' && movies[activeIndex]) {
            event.preventDefault();
            router.push(`/movies/${movies[activeIndex].id}`);
            closeOverlay(false);
        }
    }

    const message = searchMessage(term, result);

    return (
        <div
            aria-label="Film search"
            className={styles.globalSearch}
            data-open={open || undefined}
            id="shell-search"
            inert={!open}
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
                    maxLength={200}
                    onChange={(event) => {
                        setQuery(event.target.value);
                        if (event.target.value.trim() !== term) setResponse(null);
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
                    <p className={styles.overlayEmpty} role="status">
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
                                <span aria-hidden="true" className={styles.searchPoster}>
                                    PF
                                </span>
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
