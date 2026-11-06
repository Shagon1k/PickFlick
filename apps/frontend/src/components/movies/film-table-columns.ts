import type { ITableColumn } from '#components/ui/Table/Table';

export type TFilmTableVariant = 'club-ratings' | 'ratings' | 'watchlist';
export type TFilmTableColumnKey = 'rank' | 'film' | 'genre' | 'year' | 'date' | 'value';

interface IFilmTableColumn extends ITableColumn {
    key: TFilmTableColumnKey;
}

/** The loading skeleton must keep the table's geometry, so both read the columns from here. */
export function getFilmTableColumns(variant: TFilmTableVariant): IFilmTableColumn[] {
    const rank: IFilmTableColumn = { key: 'rank', header: '#', isNumeric: true };
    const film: IFilmTableColumn = { key: 'film', header: 'Film' };
    const genre: IFilmTableColumn = { key: 'genre', header: 'Genre' };
    const year: IFilmTableColumn = { key: 'year', header: 'Year' };
    if (variant === 'club-ratings')
        return [rank, film, year, genre, { key: 'value', header: 'Rating', isNumeric: true }];
    const isWatchlist = variant === 'watchlist';
    return [
        rank,
        film,
        genre,
        year,
        { key: 'date', header: isWatchlist ? 'Added on' : 'Rated on' },
        { key: 'value', header: isWatchlist ? 'Priority' : 'Rating', isNumeric: !isWatchlist },
    ];
}
