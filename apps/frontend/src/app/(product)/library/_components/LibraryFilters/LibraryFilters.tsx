'use client';

import {
    formatRatingScore,
    LIBRARY_SEARCH_MAX_LENGTH,
    RATING_SCORES,
    type TLibraryQuery,
} from '@pickflick/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

import { WATCHLIST_PRIORITIES } from '#components/movies/watchlist-priority';
import ButtonLink from '#components/ui/Button/ButtonLink';
import Select from '#components/ui/Select/Select';
import TextInput from '#components/ui/TextInput/TextInput';

import styles from './LibraryFilters.module.scss';

// Typing waits for a pause before the list reloads; a select applies at once.
const SEARCH_DELAY_MS = 400;

/** Search and filters apply as they change, as in the prototype's table tools. */
export default function LibraryFilters({ query }: { query: TLibraryQuery }) {
    const isWatchlist = query.tab === 'watchlist';
    const router = useRouter();
    const formRef = useRef<HTMLFormElement>(null);
    const searchTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    useEffect(() => () => clearTimeout(searchTimerRef.current), []);
    function apply(changed?: { name: string; value: string }) {
        clearTimeout(searchTimerRef.current);
        if (!formRef.current) return;
        const params = new URLSearchParams();
        for (const [name, value] of new FormData(formRef.current))
            if (typeof value === 'string') params.set(name, value);
        // A Mantine select updates its hidden input after onChange, so take the new value here.
        if (changed) params.set(changed.name, changed.value);
        router.replace(`/library?${params.toString()}`, { scroll: false });
    }
    return (
        <form
            action="/library"
            method="get"
            className={styles.libraryFilters}
            ref={formRef}
            onSubmit={(event) => {
                event.preventDefault();
                apply();
            }}
        >
            <input type="hidden" name="tab" value={query.tab} />
            <div className={styles.libraryFilters__search}>
                <TextInput
                    type="search"
                    id="library-q"
                    name="q"
                    label={isWatchlist ? 'Search watchlist' : 'Search rated films'}
                    placeholder="Search your films…"
                    defaultValue={query.q}
                    maxLength={LIBRARY_SEARCH_MAX_LENGTH}
                    onChange={() => {
                        clearTimeout(searchTimerRef.current);
                        searchTimerRef.current = setTimeout(apply, SEARCH_DELAY_MS);
                    }}
                />
            </div>
            {isWatchlist ? (
                <Select
                    id="library-priority"
                    name="priority"
                    label="Priority"
                    defaultValue={query.priority}
                    onChange={(value) => apply({ name: 'priority', value: value ?? '' })}
                    data={[
                        { value: '', label: 'All priorities' },
                        ...WATCHLIST_PRIORITIES.toReversed(),
                    ]}
                />
            ) : (
                <Select
                    id="library-score"
                    name="score"
                    label="Rating"
                    defaultValue={query.score}
                    onChange={(value) => apply({ name: 'score', value: value ?? '' })}
                    data={[
                        { value: '', label: 'All ratings' },
                        ...RATING_SCORES.map((score) => ({
                            value: String(score),
                            label: formatRatingScore(score),
                        })),
                    ]}
                />
            )}
            <Select
                id="library-sort"
                name="sort"
                label="Sort by"
                defaultValue={query.sort}
                onChange={(value) => apply({ name: 'sort', value: value ?? 'default' })}
                data={[
                    {
                        value: 'default',
                        label: isWatchlist ? 'Highest priority' : 'Highest rating',
                    },
                    { value: 'title', label: 'Film A to Z' },
                    { value: 'year', label: 'Newest year' },
                    { value: 'recent', label: isWatchlist ? 'Recently added' : 'Recently rated' },
                ]}
            />
            {query.q || query.score || query.priority || query.sort !== 'default' ? (
                <div className={styles.libraryFilters__actions}>
                    <ButtonLink href={`/library?tab=${query.tab}`} variant="ghost">
                        Clear
                    </ButtonLink>
                </div>
            ) : null}
        </form>
    );
}
