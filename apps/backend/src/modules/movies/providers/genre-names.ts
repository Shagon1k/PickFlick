const TMDB_GENRES: Record<number, string> = {
    28: 'Action',
    12: 'Adventure',
    16: 'Animation',
    35: 'Comedy',
    80: 'Crime',
    99: 'Documentary',
    18: 'Drama',
    10751: 'Family',
    14: 'Fantasy',
    36: 'History',
    27: 'Horror',
    10402: 'Music',
    9648: 'Mystery',
    10749: 'Romance',
    878: 'Science Fiction',
    10770: 'TV Movie',
    53: 'Thriller',
    10752: 'War',
    37: 'Western',
};

const POISKKINO_GENRES: Record<string, string> = {
    боевик: 'Action',
    приключения: 'Adventure',
    мультфильм: 'Animation',
    комедия: 'Comedy',
    криминал: 'Crime',
    документальный: 'Documentary',
    драма: 'Drama',
    семейный: 'Family',
    фэнтези: 'Fantasy',
    история: 'History',
    ужасы: 'Horror',
    музыка: 'Music',
    детектив: 'Mystery',
    мелодрама: 'Romance',
    фантастика: 'Science Fiction',
    триллер: 'Thriller',
    военный: 'War',
    вестерн: 'Western',
    аниме: 'Anime',
    биография: 'Biography',
    детский: 'Children',
    мюзикл: 'Musical',
    спорт: 'Sport',
    короткометражка: 'Short',
    'фильм-нуар': 'Film Noir',
    концерт: 'Concert',
    новости: 'News',
    'реальное тв': 'Reality TV',
    'ток-шоу': 'Talk Show',
    церемония: 'Ceremony',
};

export function getTmdbGenres(ids: number[]): string[] {
    return ids.flatMap((id) => {
        const genre = TMDB_GENRES[id];
        return genre ? [genre] : [];
    });
}

export function getPoiskkinoGenres(names: { name?: string | null }[]): string[] {
    return names.flatMap(({ name }) => {
        const genre = name ? POISKKINO_GENRES[name.toLowerCase()] : undefined;
        return genre ? [genre] : [];
    });
}
