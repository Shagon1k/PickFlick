import {
    MOVIE_CAST_LIMIT,
    movieImageUrlSchema,
    movieTrailerUrlSchema,
    type TMovieExternalId,
} from '@pickflick/contracts';
import { z } from 'zod';

import { MovieHttp } from './movie-http.js';
import {
    createEmptyMetadata,
    MovieProviderError,
    parseSourceSnapshot,
    type TSourceSnapshot,
} from './movie-provider.js';

const MAX_REMOTE_ID_MATCHES = 100;

const id = z.number().int().positive();
const response = <TData extends z.ZodType>(data: TData) =>
    z.object({ status: z.literal('success'), data });
const extended = z.object({
    id,
    image: movieImageUrlSchema.nullish().catch(null),
    originalLanguage: z.string().max(10).nullish(),
    runtime: z.number().int().nonnegative().nullish(),
    remoteIds: z.array(z.object({ sourceName: z.string(), id: z.string() })).max(100),
    first_release: z.object({ date: z.string().nullish() }).nullish(),
    genres: z
        .array(z.object({ name: z.string().min(1).max(200) }))
        .max(100)
        .nullish(),
    production_countries: z
        .array(z.object({ country: z.string().regex(/^[a-zA-Z]{2,3}$/u) }))
        .max(100)
        .nullish(),
    trailers: z
        .array(
            z.object({
                url: z.string().max(2048).nullish(),
                name: z.string().max(1000).nullish(),
                language: z.string().max(10).nullish(),
            }),
        )
        .max(200)
        .nullish(),
    budget: z.string().max(40).nullish(),
    boxOffice: z.string().max(40).nullish(),
    characters: z
        .array(
            z.object({
                peopleType: z.string(),
                personName: z.string().max(1000).nullish(),
                name: z.string().max(1000).nullish(),
                personImgURL: z.union([movieImageUrlSchema, z.literal('')]).nullish(),
                sort: z.number().int().nonnegative().nullish(),
            }),
        )
        .max(5000)
        .nullish(),
    translations: z
        .object({
            nameTranslations: z
                .array(z.object({ language: z.string(), name: z.string().max(1000).nullish() }))
                .max(1000)
                .nullish(),
            overviewTranslations: z
                .array(
                    z.object({ language: z.string(), overview: z.string().max(20000).nullish() }),
                )
                .max(1000)
                .nullish(),
        })
        .nullish(),
});
type TCharacter = NonNullable<z.infer<typeof extended>['characters']>[number];

function namesOf(characters: TCharacter[] | null | undefined, peopleType: string) {
    const names = characters
        ?.filter((person) => person.peopleType.toLowerCase() === peopleType && person.personName)
        .map((person) => person.personName ?? '');
    return names?.length ? [...new Set(names)].map((name) => ({ name })) : null;
}

/** Billed actors in order; none means unknown so another source may fill the credits. */
function castOf(characters: TCharacter[] | null | undefined) {
    const cast = characters
        ?.filter((person) => person.peopleType.toLowerCase() === 'actor' && person.personName)
        .toSorted((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
        .slice(0, MOVIE_CAST_LIMIT)
        .map((person) => ({
            name: person.personName ?? '',
            character: person.name || null,
            profileUrl: person.personImgURL || null,
        }));
    return cast?.length ? cast : null;
}

/** English YouTube trailers only; other languages would surprise an English catalog. */
function englishTrailers(trailers: z.infer<typeof extended>['trailers']) {
    const english = (trailers ?? []).flatMap((trailer) =>
        trailer.language === 'eng' &&
        trailer.url &&
        movieTrailerUrlSchema.safeParse(trailer.url).success
            ? [{ url: trailer.url, name: trailer.name || null, official: null }]
            : [],
    );
    return english.length ? english : null;
}

/** TheTVDB sends amounts in US dollars as decimal strings such as `1020000.00`; zero means unknown. */
function toDollars(value: string | null | undefined) {
    const amount = value && /^\d{1,15}(?:\.\d{1,2})?$/u.test(value) ? Math.round(Number(value)) : 0;
    return amount > 0 ? amount : null;
}

export class ThetvdbClient {
    private http: MovieHttp;
    constructor(
        private settings: { enabled: boolean; readToken?: string; timeoutMs: number },
        request: typeof fetch = fetch,
    ) {
        this.http = new MovieHttp(
            'thetvdb',
            'https://api4.thetvdb.com',
            settings.timeoutMs,
            request,
        );
    }
    async fetchDetails(externalIds: TMovieExternalId[]): Promise<TSourceSnapshot> {
        if (!this.settings.enabled || !this.settings.readToken)
            throw new MovieProviderError('DISABLED', undefined, 'thetvdb');
        const fetchedAt = new Date().toISOString();
        const imdb = externalIds.find((id) => id.source === 'imdb')?.externalId;
        const tvdbId = await this.resolveTvdbId(externalIds, imdb);
        const result = await this.http.get(
            `/v4/movies/${tvdbId}/extended?meta=translations`,
            response(extended),
            this.buildHeaders(),
        );
        const movie = result.data;
        if (String(movie.id) !== tvdbId)
            throw new MovieProviderError('INVALID_RESPONSE', undefined, 'thetvdb');
        const remoteImdb = movie.remoteIds
            .filter((remote) => remote.sourceName.toLowerCase() === 'imdb')
            .map((remote) => remote.id);
        // A remote-ID lookup must be confirmed by the movie, never by its name/year.
        if (imdb && (remoteImdb.length !== 1 || remoteImdb[0] !== imdb))
            throw new MovieProviderError('IDENTITY_CONFLICT', undefined, 'thetvdb');
        const mappedIds: TMovieExternalId[] = [{ source: 'thetvdb', externalId: tvdbId }];
        for (const externalId of remoteImdb) mappedIds.push({ source: 'imdb', externalId });
        return parseSourceSnapshot({
            source: 'thetvdb',
            locale: 'en-US',
            fetchedAt,
            externalIds: mappedIds,
            similarExternalIds: null,
            data: {
                ...createEmptyMetadata(),
                posterUrl: movie.image ?? null,
                title:
                    movie.translations?.nameTranslations?.find((text) => text.language === 'eng')
                        ?.name || null,
                overview:
                    movie.translations?.overviewTranslations?.find(
                        (text) => text.language === 'eng',
                    )?.overview || null,
                originalLanguage: movie.originalLanguage || null,
                runtime: movie.runtime || null,
                releaseDate:
                    movie.first_release?.date &&
                    /^\d{4}-\d{2}-\d{2}$/u.test(movie.first_release.date)
                        ? movie.first_release.date
                        : null,
                genres: movie.genres?.map((genre) => genre.name) ?? null,
                productionCountries:
                    movie.production_countries?.map(({ country }) => country.toUpperCase()) ?? null,
                directors: namesOf(movie.characters, 'director'),
                writers: namesOf(movie.characters, 'writer'),
                trailers: englishTrailers(movie.trailers),
                budget: toDollars(movie.budget),
                revenue: toDollars(movie.boxOffice),
                cast: castOf(movie.characters),
            },
        });
    }
    /** A known TheTVDB ID, or the single movie TheTVDB maps to the IMDb ID. */
    private async resolveTvdbId(externalIds: TMovieExternalId[], imdb: string | undefined) {
        const known = externalIds.find((id) => id.source === 'thetvdb')?.externalId;
        if (known) return known;
        if (!imdb) throw new MovieProviderError('MISSING_EXTERNAL_ID', undefined, 'thetvdb');
        const found = await this.http.get(
            `/v4/search/remoteid/${imdb}`,
            response(
                z.array(z.object({ movie: z.object({ id }).nullish() })).max(MAX_REMOTE_ID_MATCHES),
            ),
            this.buildHeaders(),
        );
        const candidates = [
            ...new Set(
                found.data.flatMap((result) => (result.movie ? [String(result.movie.id)] : [])),
            ),
        ];
        if (candidates.length > 1)
            throw new MovieProviderError('IDENTITY_CONFLICT', undefined, 'thetvdb');
        if (!candidates[0]) throw new MovieProviderError('NOT_FOUND', undefined, 'thetvdb');
        return candidates[0];
    }

    private buildHeaders() {
        return {
            Authorization: `Bearer ${this.settings.readToken ?? ''}`,
            Accept: 'application/json',
        };
    }
}
