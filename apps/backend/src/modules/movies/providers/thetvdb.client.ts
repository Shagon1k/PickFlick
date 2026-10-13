import { movieImageUrlSchema, type TMovieExternalId } from '@pickflick/contracts';
import { z } from 'zod';

import { MovieHttp } from './movie-http.js';
import {
    emptyMetadata,
    MovieProviderError,
    parseSourceSnapshot,
    type TSourceSnapshot,
} from './movie-provider.js';

const id = z.number().int().positive();
const response = <TData extends z.ZodType>(data: TData) =>
    z.object({ status: z.literal('success'), data });
const extended = z.object({
    id,
    originalLanguage: z.string().max(10).nullish(),
    runtime: z.number().int().nonnegative().nullish(),
    remoteIds: z.array(z.object({ sourceName: z.string(), id: z.string() })).max(100),
    first_release: z.object({ date: z.string().nullish() }).nullish(),
    genres: z
        .array(z.object({ name: z.string().min(1).max(200) }))
        .max(100)
        .nullish(),
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
    async details(externalIds: TMovieExternalId[]): Promise<TSourceSnapshot> {
        if (!this.settings.enabled || !this.settings.readToken)
            throw new MovieProviderError('DISABLED', undefined, 'thetvdb');
        const fetchedAt = new Date().toISOString();
        const imdb = externalIds.find((id) => id.source === 'imdb')?.externalId;
        let tvdbId = externalIds.find((id) => id.source === 'thetvdb')?.externalId;
        if (!tvdbId && !imdb)
            throw new MovieProviderError('MISSING_EXTERNAL_ID', undefined, 'thetvdb');
        if (!tvdbId && imdb) {
            const found = await this.http.get(
                `/v4/search/remoteid/${imdb}`,
                response(z.array(z.object({ movie: z.object({ id }).nullish() })).max(100)),
                this.headers(),
            );
            const candidates = [
                ...new Set(
                    found.data.flatMap((result) => (result.movie ? [String(result.movie.id)] : [])),
                ),
            ];
            if (candidates.length > 1)
                throw new MovieProviderError('IDENTITY_CONFLICT', undefined, 'thetvdb');
            tvdbId = candidates[0];
        }
        if (!tvdbId) throw new MovieProviderError('NOT_FOUND', undefined, 'thetvdb');
        const result = await this.http.get(
            `/v4/movies/${tvdbId}/extended?meta=translations`,
            response(extended),
            this.headers(),
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
                ...emptyMetadata(),
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
                directors:
                    movie.characters
                        ?.filter(
                            (person) =>
                                person.peopleType.toLowerCase() === 'director' && person.personName,
                        )
                        .map((person) => ({ name: person.personName ?? '' })) ?? null,
                cast:
                    movie.characters
                        ?.filter(
                            (person) =>
                                person.peopleType.toLowerCase() === 'actor' && person.personName,
                        )
                        .toSorted((a, b) => (a.sort ?? 0) - (b.sort ?? 0))
                        .slice(0, 50)
                        .map((person) => ({
                            name: person.personName ?? '',
                            character: person.name || null,
                            profileUrl: person.personImgURL || null,
                        })) ?? null,
            },
        });
    }
    private headers() {
        return {
            Authorization: `Bearer ${this.settings.readToken ?? ''}`,
            Accept: 'application/json',
        };
    }
}
