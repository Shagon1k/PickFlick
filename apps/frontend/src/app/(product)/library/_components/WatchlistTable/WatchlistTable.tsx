'use client';

import type { TWatchlist } from '@pickflick/contracts';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import WatchlistBookmark from '#components/movies/WatchlistBookmark/WatchlistBookmark';
import Table from '#components/ui/Table/Table';
import { formatUtcDate } from '#lib/format';

export default function WatchlistTable({ items }: TWatchlist) {
    const headingRef = useRef<HTMLHeadingElement>(null);
    const [message, setMessage] = useState('');
    const shouldFocusHeadingRef = useRef(false);
    useEffect(() => {
        if (!shouldFocusHeadingRef.current) return;
        headingRef.current?.focus();
        shouldFocusHeadingRef.current = false;
    }, [items, message]);
    function handleRemoved() {
        shouldFocusHeadingRef.current = true;
        setMessage('Removed from Watchlist.');
    }
    return (
        <section aria-labelledby="watchlist-heading">
            <h2 id="watchlist-heading" ref={headingRef} tabIndex={-1}>
                Watchlist
            </h2>
            <p role="status">
                {message || `${items.length} ${items.length === 1 ? 'film' : 'films'} queued`}
            </p>
            <Table
                caption="Films to watch"
                columns={[
                    { key: 'film', header: 'Film' },
                    { key: 'year', header: 'Year' },
                    { key: 'addedAt', header: 'Added on' },
                    { key: 'priority', header: 'Priority' },
                ]}
                rows={items.map((item) => ({
                    id: item.movieId,
                    cells: {
                        film: (
                            <Link href={`/movies/${item.movieId}`}>
                                {item.title ?? 'Untitled film'}
                            </Link>
                        ),
                        year: item.releaseYear ?? '—',
                        addedAt: formatUtcDate(item.addedAt),
                        priority: (
                            <WatchlistBookmark
                                movieId={item.movieId}
                                item={item}
                                variant="table"
                                onRemoved={handleRemoved}
                            />
                        ),
                    },
                }))}
                emptyMessage="Your Watchlist is empty. Save a film from Movie Details to see it here."
            />
        </section>
    );
}
