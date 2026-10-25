'use client';

import { LIBRARY_SEARCH_MAX_LENGTH, type TLibraryQuery } from '@pickflick/contracts';

import Button from '#components/ui/Button/Button';
import ButtonLink from '#components/ui/Button/ButtonLink';
import Select from '#components/ui/Select/Select';
import TextInput from '#components/ui/TextInput/TextInput';

import styles from './LibraryFilters.module.scss';

const MAX_RATING = 10;

export default function LibraryFilters({ query }: { query: TLibraryQuery }) {
    const isWatchlist = query.tab === 'watchlist';
    return (
        <form action="/library" method="get" className={styles.libraryFilters}>
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
                />
            </div>
            {isWatchlist ? (
                <Select
                    id="library-priority"
                    name="priority"
                    label="Priority"
                    defaultValue={query.priority}
                    data={[
                        { value: '', label: 'All priorities' },
                        { value: 'HIGH', label: 'High' },
                        { value: 'MEDIUM', label: 'Medium' },
                        { value: 'LOW', label: 'Low' },
                    ]}
                />
            ) : (
                <Select
                    id="library-score"
                    name="score"
                    label="Rating"
                    defaultValue={query.score}
                    data={[
                        { value: '', label: 'All ratings' },
                        ...Array.from({ length: MAX_RATING }, (_, index) => ({
                            value: String(index + 1),
                            label: `${index + 1}/10`,
                        })),
                    ]}
                />
            )}
            <Select
                id="library-sort"
                name="sort"
                label="Sort by"
                defaultValue={query.sort}
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
            <div className={styles.libraryFilters__actions}>
                <Button type="submit">Apply</Button>
                <ButtonLink href={`/library?tab=${query.tab}`} variant="ghost">
                    Clear
                </ButtonLink>
            </div>
        </form>
    );
}
