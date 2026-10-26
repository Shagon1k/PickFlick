import {
    movieExternalIdSchema,
    movieMetadataSchema,
    movieProvenanceSchema,
    movieSourceSchema,
    type TMovieExternalId,
    type TMovieProviderReason,
    type TMovieSearch,
    type TMovieSource,
} from '@pickflick/contracts';
import { z } from 'zod';

const sourceSnapshotSchema = z.strictObject({
    source: movieSourceSchema,
    locale: z.literal('en-US'),
    fetchedAt: z.iso.datetime(),
    externalIds: z.array(movieExternalIdSchema).min(1).max(10),
    data: movieMetadataSchema,
    similarExternalIds: z.array(z.array(movieExternalIdSchema).min(1).max(10)).max(100).nullable(),
});
export type TSourceSnapshot = z.infer<typeof sourceSnapshotSchema>;
export function parseSourceSnapshot(value: unknown): TSourceSnapshot {
    const parsed = sourceSnapshotSchema.safeParse(value);
    if (!parsed.success) throw new MovieProviderError('INVALID_RESPONSE');
    return parsed.data;
}
const providerRecordSchema = z.strictObject({
    externalIds: z.array(movieExternalIdSchema).min(1).max(10),
    data: movieMetadataSchema,
    similarExternalIds: sourceSnapshotSchema.shape.similarExternalIds,
    provenance: z.array(movieProvenanceSchema).min(1).max(3),
});
export type TProviderRecord = z.infer<typeof providerRecordSchema>;
export type TProviderSearch = {
    movies: TProviderRecord[];
    page: number;
    totalPages: number;
    totalResults: number;
};
export function toProviderRecord(snapshot: TSourceSnapshot): TProviderRecord {
    return parseProviderRecord({
        externalIds: snapshot.externalIds,
        data: snapshot.data,
        similarExternalIds: snapshot.similarExternalIds,
        provenance: [
            {
                source: snapshot.source,
                fetchedAt: snapshot.fetchedAt,
                reason: null,
                sections: ['metadata', 'media', 'ratings', 'similar'],
            },
        ],
    });
}
export function createEmptyMetadata() {
    return movieMetadataSchema.parse({
        title: null,
        originalTitle: null,
        overview: null,
        releaseDate: null,
        releaseYear: null,
        adult: null,
        originalLanguage: null,
        posterUrl: null,
        backdropUrl: null,
        ratings: [],
        runtime: null,
        genres: null,
        productionCountries: null,
        directors: null,
        writers: null,
        cast: null,
        trailers: null,
        budget: null,
        revenue: null,
    });
}
export function parseProviderRecord(value: unknown): TProviderRecord {
    const parsed = providerRecordSchema.safeParse(value);
    if (!parsed.success) throw new MovieProviderError('INVALID_RESPONSE');
    return parsed.data;
}

export const MOVIE_PROVIDER = Symbol('MOVIE_PROVIDER');
export interface IMovieLookup {
    externalIds: TMovieExternalId[];
    locale: 'en-US';
}
export interface IMovieProvider {
    search(input: TMovieSearch): Promise<TProviderSearch>;
    fetchDetails(input: IMovieLookup): Promise<TProviderRecord>;
}
export class MovieProviderError extends Error {
    constructor(
        public reason: TMovieProviderReason,
        public retryAt?: Date,
        public source?: TMovieSource,
    ) {
        super(`Movie provider: ${reason}`);
    }
}
export function canUseStale(reason: TMovieProviderReason): boolean {
    return ['TIMEOUT', 'RATE_LIMITED', 'UNAVAILABLE'].includes(reason);
}
