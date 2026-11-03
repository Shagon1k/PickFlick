'use client';

import {
    CLUB_RATINGS_SEARCH_MAX_LENGTH,
    type TClubRatings,
    type TClubRatingsQuery,
} from '@pickflick/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import Button from '#components/ui/Button/Button';
import Icon from '#components/ui/Icon/Icon';
import Table from '#components/ui/Table/Table';
import TableSearch from '#components/ui/TableSearch/TableSearch';
import { formatAverage, formatCount } from '#lib/format';
import { getOfflineMessage } from '#lib/offline';
import { getNextTableSort } from '#lib/table-sort';

import styles from './ClubRatings.module.scss';

export default function ClubRatings({
    clubId,
    ratings,
    query,
}: {
    clubId: string;
    ratings: TClubRatings;
    query: TClubRatingsQuery;
}) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState('');
    function navigate(next: TClubRatingsQuery, shouldReplace = false) {
        const offline = getOfflineMessage();
        if (offline) {
            setMessage(offline);
            return;
        }
        setMessage('');
        const search = new URLSearchParams({ sort: next.sort, page: String(next.page) });
        if (next.q) search.set('q', next.q);
        if (next.direction) search.set('direction', next.direction);
        const path = `/clubs/${clubId}/ratings?${search}`;
        startTransition(() => {
            if (shouldReplace) router.replace(path, { scroll: false });
            else router.push(path, { scroll: false });
        });
    }
    function sortable(sort: TClubRatingsQuery['sort']) {
        return {
            sortDirection: query.sort === sort ? query.direction : undefined,
            isSortDisabled: isPending,
            onSort: () =>
                navigate({
                    ...query,
                    sort: 'rating',
                    direction: undefined,
                    ...getNextTableSort(query, sort),
                    page: 1,
                }),
        };
    }
    const status = isPending ? 'Loading Club ratings…' : formatCount(ratings.total, 'rated film');
    return (
        <section
            className={styles.clubRatings}
            aria-labelledby="club-ratings-heading"
            aria-busy={isPending}
        >
            <h2 id="club-ratings-heading" className="visually-hidden">
                Club Ratings
            </h2>
            <TableSearch
                value={query.q ?? ''}
                label="Search rated films…"
                maxLength={CLUB_RATINGS_SEARCH_MAX_LENGTH}
                onSearch={(q) => {
                    if (q.trim() !== (query.q ?? '')) navigate({ ...query, q, page: 1 }, true);
                }}
            />
            <p className={message ? undefined : 'visually-hidden'} role="status">
                {message || status}
            </p>
            <Table
                variant="leaderboard"
                caption="Club rating leaderboard"
                columns={[
                    { key: 'rank', header: '#', isNumeric: true },
                    { key: 'film', header: 'Film', ...sortable('title') },
                    { key: 'year', header: 'Year', ...sortable('year') },
                    { key: 'genre', header: 'Genre', ...sortable('genre') },
                    { key: 'rating', header: 'Rating', isNumeric: true, ...sortable('rating') },
                ]}
                rows={ratings.items.map((item, index) => ({
                    id: item.movieId,
                    cells: {
                        rank: (ratings.page - 1) * ratings.pageSize + index + 1,
                        film: (
                            <Link
                                className={styles.clubRatings__film}
                                href={`/movies/${item.movieId}`}
                            >
                                {item.title ?? 'Untitled film'}
                            </Link>
                        ),
                        year: item.year ?? '—',
                        genre: item.genres.join(', ') || '—',
                        rating: (
                            <span className={styles.clubRatings__rating}>
                                {formatAverage(item.averageRating)}
                            </span>
                        ),
                    },
                }))}
                emptyMessage={query.q ? 'No rated films match your search.' : 'No rated films yet.'}
            />
            <nav aria-label="Club Ratings pages" className={styles.clubRatings__pagination}>
                <Button
                    aria-label="Previous page"
                    variant="navigation"
                    size="icon"
                    disabled={isPending || ratings.page === 1}
                    onClick={() => navigate({ ...query, page: ratings.page - 1 })}
                >
                    <Icon name="arrow-left" />
                </Button>
                <span>
                    Page {ratings.page} of {ratings.pages}
                </span>
                <Button
                    aria-label="Next page"
                    variant="navigation"
                    size="icon"
                    data-direction="next"
                    disabled={isPending || ratings.page === ratings.pages}
                    onClick={() => navigate({ ...query, page: ratings.page + 1 })}
                >
                    <Icon name="arrow-left" />
                </Button>
            </nav>
        </section>
    );
}
