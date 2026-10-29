'use client';

import type { TClubRatings, TClubRatingsQuery } from '@pickflick/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import Button from '#components/ui/Button/Button';
import Select from '#components/ui/Select/Select';
import Table from '#components/ui/Table/Table';
import { formatAverage, formatCount } from '#lib/format';
import { getOfflineMessage } from '#lib/offline';

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
    function navigate(sort: string, page: number) {
        const offline = getOfflineMessage();
        if (offline) {
            setMessage(offline);
            return;
        }
        setMessage('');
        startTransition(() =>
            router.push(
                `/clubs/${clubId}/ratings?${new URLSearchParams({ sort, page: String(page) })}`,
                { scroll: false },
            ),
        );
    }
    const count = formatCount(ratings.total, 'rated film');
    const status = isPending ? 'Loading Club ratings…' : count;
    return (
        <section
            className={styles.clubRatings}
            aria-labelledby="club-ratings-heading"
            aria-busy={isPending}
        >
            <h2 id="club-ratings-heading">Club Ratings</h2>
            {ratings.analytics === 'BASIC' ? (
                <p>Extended Club analytics and the ratings leaderboard are available with Pro.</p>
            ) : (
                <>
                    <p>
                        Average received ratings from completed screenings you can view. Repeat
                        screenings count together; missing ratings stay unknown.
                    </p>
                    <div className={styles.clubRatings__sort}>
                        <Select
                            id="club-ratings-sort"
                            label="Sort films"
                            value={query.sort}
                            disabled={isPending}
                            data={[
                                { value: 'rating', label: 'Highest rating' },
                                { value: 'time', label: 'Latest screening' },
                                { value: 'title', label: 'Film title' },
                            ]}
                            onChange={(sort) => {
                                if (sort) navigate(sort, 1);
                            }}
                        />
                    </div>
                    <p role="status">{message || status}</p>
                    <Table
                        caption="Club rating leaderboard"
                        columns={[
                            { key: 'rank', header: '#', numeric: true },
                            { key: 'film', header: 'Film' },
                            { key: 'year', header: 'Year' },
                            { key: 'genre', header: 'Genre' },
                            { key: 'rating', header: 'Rating', numeric: true },
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
                        emptyMessage="No published ratings yet. Complete a Session with visible ratings to see films here."
                    />
                    <nav aria-label="Club Ratings pages" className={styles.clubRatings__pagination}>
                        <Button
                            variant="secondary"
                            disabled={isPending || ratings.page === 1}
                            onClick={() => navigate(query.sort, ratings.page - 1)}
                        >
                            Previous
                        </Button>
                        <span>
                            Page {ratings.page} of {ratings.pages}
                        </span>
                        <Button
                            variant="secondary"
                            disabled={isPending || ratings.page === ratings.pages}
                            onClick={() => navigate(query.sort, ratings.page + 1)}
                        >
                            Next
                        </Button>
                    </nav>
                </>
            )}
        </section>
    );
}
