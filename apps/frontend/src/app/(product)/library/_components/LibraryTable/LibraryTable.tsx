'use client';

import type { TLibrary, TLibraryQuery } from '@pickflick/contracts';
import Link from 'next/link';
import { type ReactNode, useEffect, useRef, useState } from 'react';

import PersonalRating from '#components/movies/PersonalRating/PersonalRating';
import WatchlistBookmark from '#components/movies/WatchlistBookmark/WatchlistBookmark';
import ButtonLink from '#components/ui/Button/ButtonLink';
import Table from '#components/ui/Table/Table';
import { formatCount, formatUtcDate } from '#lib/format';

import { buildLibraryPath } from '../../library-path';
import LibraryFilters from '../LibraryFilters/LibraryFilters';
import styles from './LibraryTable.module.scss';

export default function LibraryTable({
    library,
    query,
}: {
    library: TLibrary;
    query: TLibraryQuery;
}) {
    const headingRef = useRef<HTMLHeadingElement>(null);
    const [message, setMessage] = useState('');
    const shouldFocusHeadingRef = useRef(false);
    useEffect(() => {
        if (!shouldFocusHeadingRef.current) return;
        headingRef.current?.focus();
        shouldFocusHeadingRef.current = false;
    }, [library, message]);
    function handleSaved(message: string) {
        shouldFocusHeadingRef.current = true;
        setMessage(message);
    }
    const isWatchlist = library.tab === 'watchlist';
    const title = isWatchlist ? 'Watchlist' : 'My Ratings';
    const hasFilters = Boolean(query.q || (isWatchlist ? query.priority : query.score));
    const emptyLibraryMessage = isWatchlist
        ? 'Your Watchlist is empty. Save a film from Movie Details to see it here.'
        : 'No rated films yet. Rate a film from Movie Details to see it here.';
    const emptyMessage = hasFilters
        ? 'No films match your search or filters. Clear them to see all your films.'
        : emptyLibraryMessage;
    const toRow = (
        item: TLibrary['items'][number],
        index: number,
        date: string,
        action: ReactNode,
    ) => ({
        id: item.movieId,
        cells: {
            rank: (library.page - 1) * library.pageSize + index + 1,
            film: (
                <Link href={`/movies/${item.movieId}`} className={styles.libraryTable__film}>
                    <span className={styles.libraryTable__title}>
                        {item.title ?? 'Untitled film'}
                    </span>
                </Link>
            ),
            genres: item.genres.join(', ') || '—',
            year: item.releaseYear ?? '—',
            date: formatUtcDate(date),
            action,
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
                      <PersonalRating movieId={item.movieId} rating={item} onSaved={handleSaved} />,
                  ),
              );
    return (
        <section aria-labelledby="library-heading" className={styles.libraryTable}>
            <h2 id="library-heading" ref={headingRef} tabIndex={-1}>
                {title}
            </h2>
            <LibraryFilters key={buildLibraryPath(query)} query={query} />
            <p role="status">
                {message && `${message} `}
                {`${formatCount(library.total, 'film')} ${isWatchlist ? 'queued' : 'rated'}`}
            </p>
            <Table
                caption={isWatchlist ? 'Films to watch' : 'Rated films'}
                columns={[
                    { key: 'rank', header: '#', numeric: true },
                    { key: 'film', header: 'Film' },
                    { key: 'genres', header: 'Genre' },
                    { key: 'year', header: 'Year' },
                    { key: 'date', header: isWatchlist ? 'Added on' : 'Rated on' },
                    { key: 'action', header: isWatchlist ? 'Priority' : 'Rating' },
                ]}
                rows={rows}
                emptyMessage={emptyMessage}
            />
            <nav aria-label={`${title} pages`} className={styles.libraryTable__pagination}>
                <ButtonLink
                    href={buildLibraryPath(query, library.page - 1)}
                    disabled={library.page === 1}
                >
                    Previous
                </ButtonLink>
                <span>
                    Page {library.page} of {library.pages}
                </span>
                <ButtonLink
                    href={buildLibraryPath(query, library.page + 1)}
                    disabled={library.page === library.pages}
                >
                    Next
                </ButtonLink>
            </nav>
        </section>
    );
}
