'use client';

import {
    CLUB_RATINGS_SEARCH_MAX_LENGTH,
    type TClubRatings,
    type TClubRatingsQuery,
} from '@pickflick/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import {
    getFilmTableColumns,
    type TFilmTableColumnKey,
} from '#components/movies/film-table-columns';
import FilmTablePagination from '#components/movies/FilmTablePagination/FilmTablePagination';
import { buildFilmTableSkeletonRows } from '#components/movies/FilmTableSkeleton/FilmTableSkeleton';
import PersonalFilmTable from '#components/movies/PersonalFilmTable/PersonalFilmTable';
import TableSearch from '#components/ui/TableSearch/TableSearch';
import { formatAverage, formatCount, formatMovieTitle } from '#lib/format';
import { getOfflineMessage } from '#lib/offline';
import { getNextTableSort } from '#lib/table-sort';

import { buildClubRatingsPath } from '../../ratings-path';
import styles from './ClubRatings.module.scss';

const SORTS: Partial<Record<TFilmTableColumnKey, TClubRatingsQuery['sort']>> = {
    film: 'title',
    year: 'year',
    genre: 'genre',
    value: 'rating',
};

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
    function navigate(next: TClubRatingsQuery, { shouldReplace = false } = {}) {
        const offline = getOfflineMessage();
        if (offline) {
            setMessage(offline);
            return;
        }
        setMessage('');
        const path = buildClubRatingsPath(clubId, next);
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
                onSearch={(search) => {
                    if (search.trim() !== (query.q ?? ''))
                        navigate({ ...query, q: search, page: 1 }, { shouldReplace: true });
                }}
            />
            <p className={message ? undefined : 'visually-hidden'} role="status">
                {message || status}
            </p>
            <PersonalFilmTable
                variant="leaderboard"
                isLoading={isPending}
                caption="Club rating leaderboard"
                columns={getFilmTableColumns('club-ratings').map((column) => {
                    const sort = SORTS[column.key];
                    return sort ? { ...column, ...sortable(sort) } : column;
                })}
                rows={
                    isPending
                        ? buildFilmTableSkeletonRows('club-ratings', ratings.items.length || 1)
                        : ratings.items.map((item, index) => ({
                              id: item.movieId,
                              cells: {
                                  rank: (ratings.page - 1) * ratings.pageSize + index + 1,
                                  film: (
                                      <Link
                                          className={styles.clubRatings__film}
                                          href={`/movies/${item.movieId}`}
                                      >
                                          {formatMovieTitle(item)}
                                      </Link>
                                  ),
                                  year: item.year ?? '—',
                                  genre: item.genres.join(', ') || '—',
                                  value: (
                                      <span className={styles.clubRatings__rating}>
                                          {formatAverage(item.averageRating)}
                                      </span>
                                  ),
                              },
                          }))
                }
                emptyMessage={query.q ? 'No rated films match your search.' : 'No rated films yet.'}
            />
            <FilmTablePagination
                label="Club Ratings pages"
                page={ratings.page}
                pages={ratings.pages}
                disabled={isPending}
                getHref={(page) => buildClubRatingsPath(clubId, { ...query, page })}
                onNavigate={(page) => navigate({ ...query, page })}
            />
        </section>
    );
}
