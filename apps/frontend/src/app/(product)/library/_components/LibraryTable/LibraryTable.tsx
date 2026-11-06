'use client';

import {
    LIBRARY_SEARCH_MAX_LENGTH,
    libraryQuerySchema,
    type TLibrary,
    type TLibraryQuery,
} from '@pickflick/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useRef, useState, useTransition } from 'react';

import { buildFilmTableSkeletonRows } from '#components/movies/FilmTableSkeleton/FilmTableSkeleton';
import PersonalRating from '#components/movies/PersonalRating/PersonalRating';
import WatchlistBookmark from '#components/movies/WatchlistBookmark/WatchlistBookmark';
import ButtonLink from '#components/ui/Button/ButtonLink';
import Icon from '#components/ui/Icon/Icon';
import LocalTime from '#components/ui/LocalTime/LocalTime';
import Table from '#components/ui/Table/Table';
import TableSearch from '#components/ui/TableSearch/TableSearch';
import { formatCount, formatMovieTitle } from '#lib/format';
import { getOfflineMessage } from '#lib/offline';
import { getNextTableSort } from '#lib/table-sort';

import { buildLibraryPath } from '../../library-path';
import styles from './LibraryTable.module.scss';

export default function LibraryTable({
    library,
    query,
}: {
    library: TLibrary;
    query: TLibraryQuery;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [navigationMessage, setNavigationMessage] = useState('');
    const headingRef = useRef<HTMLHeadingElement>(null);
    const [savedMessage, setSavedMessage] = useState('');
    const shouldFocusHeadingRef = useRef(false);
    useEffect(() => {
        if (!shouldFocusHeadingRef.current) return;
        headingRef.current?.focus({ preventScroll: true });
        shouldFocusHeadingRef.current = false;
    }, [library, savedMessage]);
    function handleSaved(nextMessage: string) {
        shouldFocusHeadingRef.current = true;
        setSavedMessage(nextMessage);
    }
    function navigate(next: TLibraryQuery, { shouldReplace = false } = {}) {
        const offline = getOfflineMessage();
        if (offline) {
            setNavigationMessage(offline);
            return;
        }
        setNavigationMessage('');
        startTransition(() => {
            const path = buildLibraryPath(next);
            if (shouldReplace) router.replace(path, { scroll: false });
            else router.push(path, { scroll: false });
        });
    }
    function sortable(sort: TLibraryQuery['sort']) {
        return {
            sortDirection: query.sort === sort ? query.direction : undefined,
            isSortDisabled: isPending,
            onSort: () =>
                navigate({
                    ...query,
                    sort: 'default',
                    direction: undefined,
                    ...getNextTableSort(query, sort),
                    page: 1,
                }),
        };
    }
    const isWatchlist = library.tab === 'watchlist';
    const title = isWatchlist ? 'Watchlist' : 'My Ratings';
    const valueFilter = isWatchlist ? query.priority : query.score;
    const hasFilters = Boolean(query.q || valueFilter);
    const emptyMessage = getEmptyMessage(isWatchlist, hasFilters);
    const skeletonVariant = isWatchlist ? 'watchlist' : 'ratings';
    const countLabel = formatCount(library.total, isWatchlist ? 'queued film' : 'rated film');
    const toRow = (
        item: TLibrary['items'][number],
        index: number,
        date: string,
        value: ReactNode,
    ) => ({
        id: item.movieId,
        cells: {
            rank: (library.page - 1) * library.pageSize + index + 1,
            film: (
                <Link href={`/movies/${item.movieId}`} className={styles.libraryTable__film}>
                    <span className={styles.libraryTable__title}>{formatMovieTitle(item)}</span>
                </Link>
            ),
            genre: item.genres.join(', ') || '—',
            year: item.releaseYear ?? '—',
            date: <LocalTime format="date" value={date} />,
            value,
        },
    });
    const rows =
        library.tab === 'watchlist'
            ? library.items.map((item, index) =>
                  toRow(
                      item,
                      index,
                      item.addedAt,
                      <WatchlistBookmark
                          movieId={item.movieId}
                          item={item}
                          variant="table"
                          onSaved={handleSaved}
                      />,
                  ),
              )
            : library.items.map((item, index) =>
                  toRow(
                      item,
                      index,
                      item.updatedAt,
                      <PersonalRating
                          isInTable
                          movieId={item.movieId}
                          rating={item}
                          onSaved={handleSaved}
                      />,
                  ),
              );
    return (
        <section
            aria-labelledby="library-heading"
            className={styles.libraryTable}
            aria-busy={isPending}
        >
            <h2 className="visually-hidden" id="library-heading" ref={headingRef} tabIndex={-1}>
                {title}
            </h2>
            <TableSearch
                value={query.q}
                label={isWatchlist ? 'Search watchlist…' : 'Search rated films…'}
                maxLength={LIBRARY_SEARCH_MAX_LENGTH}
                onSearch={(search) => {
                    if (search.trim() !== query.q)
                        navigate({ ...query, q: search, page: 1 }, { shouldReplace: true });
                }}
            />
            {/* The same rule as the empty copy: search text or this tab's own value filter. */}
            {hasFilters ? (
                <ButtonLink
                    href={`/library?tab=${query.tab}`}
                    variant="subtle"
                    onNavigate={(event) => {
                        event.preventDefault();
                        navigate(libraryQuerySchema.parse({ tab: query.tab }));
                    }}
                >
                    Clear filters
                </ButtonLink>
            ) : null}
            <p className="visually-hidden" role="status">
                {isPending ? 'Loading films…' : savedMessage || countLabel}
            </p>
            <p hidden={!navigationMessage} role="status">
                {navigationMessage}
            </p>
            <Table
                variant="leaderboard"
                isLoading={isPending}
                caption={isWatchlist ? 'Films to watch' : 'Rated films'}
                columns={[
                    { key: 'rank', header: '#', isNumeric: true },
                    { key: 'film', header: 'Film', ...sortable('title') },
                    { key: 'genre', header: 'Genre', ...sortable('genre') },
                    { key: 'year', header: 'Year', ...sortable('year') },
                    {
                        key: 'date',
                        header: isWatchlist ? 'Added on' : 'Rated on',
                        ...sortable('recent'),
                    },
                    {
                        key: 'value',
                        header: isWatchlist ? 'Priority' : 'Rating',
                        isNumeric: !isWatchlist,
                        ...sortable('value'),
                    },
                ]}
                rows={
                    isPending ? buildFilmTableSkeletonRows(skeletonVariant, rows.length || 1) : rows
                }
                emptyMessage={emptyMessage}
            />
            <nav aria-label={`${title} pages`} className={styles.libraryTable__pagination}>
                <ButtonLink
                    aria-label="Previous page"
                    variant="navigation"
                    href={buildLibraryPath(query, library.page - 1)}
                    onNavigate={(event) => {
                        event.preventDefault();
                        navigate({ ...query, page: library.page - 1 });
                    }}
                    disabled={isPending || library.page === 1}
                >
                    <Icon name="arrow-left" />
                </ButtonLink>
                <span>
                    Page {library.page} of {library.pages}
                </span>
                <ButtonLink
                    aria-label="Next page"
                    variant="navigation"
                    data-direction="next"
                    href={buildLibraryPath(query, library.page + 1)}
                    onNavigate={(event) => {
                        event.preventDefault();
                        navigate({ ...query, page: library.page + 1 });
                    }}
                    disabled={isPending || library.page === library.pages}
                >
                    <Icon name="arrow-left" />
                </ButtonLink>
            </nav>
        </section>
    );
}

function getEmptyMessage(isWatchlist: boolean, hasFilters: boolean) {
    if (hasFilters)
        return 'No films match your search or filters. Clear them to see all your films.';
    if (isWatchlist)
        return 'Your Watchlist is empty. Save a film from Movie Details to see it here.';
    return 'No rated films yet. Rate a film from Movie Details to see it here.';
}
