'use client';

import { useEffect, useState } from 'react';

import { searchMoviesAction } from './actions';

export type TMovieSearchResponse = Awaited<ReturnType<typeof searchMoviesAction>>;

const DEBOUNCE_MS = 300;

/** Debounces a film search and returns the result for the current term, or null while it loads. */
export function useMovieSearch(term: string, isEnabled: boolean): TMovieSearchResponse | null {
    const [response, setResponse] = useState<{
        query: string;
        result: TMovieSearchResponse;
    } | null>(null);
    useEffect(() => {
        if (!isEnabled || !term) return;
        let isCancelled = false;
        const timer = setTimeout(() => {
            void searchMoviesAction(term).then(
                (result) => {
                    if (!isCancelled) setResponse({ query: term, result });
                },
                () => {
                    if (!isCancelled) setResponse({ query: term, result: { state: 'error' } });
                },
            );
        }, DEBOUNCE_MS);
        return () => {
            isCancelled = true;
            clearTimeout(timer);
        };
    }, [isEnabled, term]);
    return isEnabled && response?.query === term ? response.result : null;
}

/** The live status line shared by every film search field. */
export function searchMessage(term: string, result: TMovieSearchResponse | null): string {
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

/** Moves a listbox's active option for ArrowDown/ArrowUp, wrapping at both ends. */
export function nextOptionIndex(key: string, current: number, count: number): number {
    if (key === 'ArrowDown') return (current + 1) % count;
    return current < 0 ? count - 1 : (current - 1 + count) % count;
}

/** Keeps the active option of a listbox visible while the keyboard moves through it. */
export function useActiveOptionVisible(idPrefix: string, index: number): void {
    useEffect(() => {
        if (index >= 0)
            document.getElementById(`${idPrefix}-${index}`)?.scrollIntoView({ block: 'nearest' });
    }, [idPrefix, index]);
}
