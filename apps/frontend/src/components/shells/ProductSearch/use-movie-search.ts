'use client';

import { useEffect, useState } from 'react';

import { searchMoviesAction } from './actions';

export type TMovieSearchResult = Awaited<ReturnType<typeof searchMoviesAction>>;

export function useMovieSearch(query: string, enabled: boolean) {
    const term = query.trim();
    const [response, setResponse] = useState<{ query: string; result: TMovieSearchResult } | null>(
        null,
    );
    useEffect(() => {
        if (!enabled || !term) return;
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
    }, [enabled, term]);
    return {
        result: enabled && response?.query === term ? response.result : null,
        clear: () => setResponse(null),
    };
}
