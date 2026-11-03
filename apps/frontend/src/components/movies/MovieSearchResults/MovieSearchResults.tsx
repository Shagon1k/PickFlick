'use client';

import type { TMovieSummary } from '@pickflick/contracts';
import Link from 'next/link';

import { getSearchMessage, type TMovieSearchResponse } from '#components/movies/movie-search';
import SearchCredits from '#components/movies/SearchCredits/SearchCredits';
import SearchPoster from '#components/movies/SearchPoster/SearchPoster';
import Skeleton from '#components/ui/Skeleton/Skeleton';
import { formatCount } from '#lib/format';

import styles from './MovieSearchResults.module.scss';

const SKELETON_ROWS = 5;

/** Shared results for header navigation and form pickers; only the native option action differs. */
export default function MovieSearchResults({
    idPrefix,
    term,
    result,
    activeIndex,
    disabled = false,
    onSelect,
    onNavigate,
}: {
    idPrefix: string;
    term: string;
    result: TMovieSearchResponse | null;
    activeIndex: number;
    disabled?: boolean;
    onSelect?: (movie: TMovieSummary) => void;
    onNavigate?: () => void;
}) {
    if (!term) return null;
    const movies = result && 'data' in result ? result.data.movies : [];
    const isLoading = !result;
    const message = getSearchMessage(term, result);
    return (
        <div className={styles.results}>
            <div className={styles.header}>
                {result?.state === 'stale' ? <span>Cached</span> : null}
                {isLoading ? (
                    <div className={styles.countSkeleton}>
                        <Skeleton tone="search" shouldFill />
                    </div>
                ) : null}
                {result && 'data' in result ? (
                    <span className={styles.count}>{formatCount(movies.length, 'film')} found</span>
                ) : null}
            </div>
            <p className="visually-hidden" role="status">
                {message}
            </p>
            <div className={styles.body}>
                <ul
                    aria-label="Film results"
                    aria-busy={isLoading}
                    className={styles.list}
                    id={`${idPrefix}-results`}
                    role="listbox"
                    tabIndex={-1}
                >
                    {movies.map((movie, index) => {
                        const title = movie.title ?? movie.originalTitle ?? 'Untitled film';
                        const meta = [
                            movie.releaseYear ?? 'Year unavailable',
                            movie.genres?.join(', '),
                        ]
                            .filter(Boolean)
                            .join(' · ');
                        const attributes = {
                            'aria-selected': activeIndex === index,
                            className: styles.option,
                            id: `${idPrefix}-${index}`,
                            role: 'option' as const,
                        };
                        const content = (
                            <>
                                <SearchPoster url={movie.posterUrl} className={styles.poster} />
                                <span className={styles.info}>
                                    <strong title={title}>{title}</strong>
                                    <span title={meta}>{meta}</span>
                                </span>
                            </>
                        );
                        return (
                            <li key={movie.id} role="presentation">
                                {onSelect ? (
                                    <button
                                        {...attributes}
                                        disabled={disabled}
                                        onClick={() => onSelect(movie)}
                                        tabIndex={-1}
                                        type="button"
                                    >
                                        {content}
                                    </button>
                                ) : (
                                    <Link
                                        {...attributes}
                                        href={`/movies/${movie.id}`}
                                        onClick={onNavigate}
                                        prefetch={false}
                                        tabIndex={-1}
                                    >
                                        {content}
                                    </Link>
                                )}
                            </li>
                        );
                    })}
                </ul>
                {!movies.length ? (
                    <SearchState
                        isLoading={isLoading}
                        message={message}
                        shouldSignIn={result?.state === 'signed-out'}
                    />
                ) : null}
            </div>
            {movies.length ? <SearchCredits movies={movies} /> : null}
        </div>
    );
}

function SearchState({
    isLoading,
    message,
    shouldSignIn,
}: {
    isLoading: boolean;
    message: string;
    shouldSignIn: boolean;
}) {
    if (isLoading)
        return (
            <div aria-hidden="true" className={styles.loading}>
                {Array.from({ length: SKELETON_ROWS }, (_, index) => (
                    <div className={styles.skeletonRow} key={index}>
                        <div className={styles.posterSkeleton}>
                            <Skeleton tone="search" shouldFill />
                        </div>
                        <div className={styles.skeletonText}>
                            <div>
                                <Skeleton tone="search" shouldFill />
                            </div>
                            <div>
                                <Skeleton tone="search" shouldFill />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    return (
        <div className={styles.empty}>
            <p>{message}</p>
            {shouldSignIn ? <Link href="/login">Sign in</Link> : null}
        </div>
    );
}
