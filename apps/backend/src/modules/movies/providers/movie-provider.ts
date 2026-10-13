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

export const sourceSnapshotSchema = z.strictObject({
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
const sourceRemovalSchema = z.strictObject({
    source: movieSourceSchema,
    attemptedAt: z.iso.datetime(),
});
export type TSourceRemoval = z.infer<typeof sourceRemovalSchema>;
const providerRecordSchema = z.strictObject({
    externalIds: z.array(movieExternalIdSchema).min(1).max(10),
    data: movieMetadataSchema,
    similarExternalIds: sourceSnapshotSchema.shape.similarExternalIds,
    snapshots: z.array(sourceSnapshotSchema).min(1).max(3),
    removals: z.array(sourceRemovalSchema).max(3).default([]),
    provenance: z.array(movieProvenanceSchema).min(1).max(3),
});
export type TProviderRecord = z.infer<typeof providerRecordSchema>;
export type TProviderSearch = {
    movies: TProviderRecord[];
    page: number;
    totalPages: number;
    totalResults: number;
};
export function singleSource(snapshot: TSourceSnapshot): TProviderRecord {
    return parseProviderRecord({
        externalIds: snapshot.externalIds,
        data: snapshot.data,
        similarExternalIds: snapshot.similarExternalIds,
        snapshots: [snapshot],
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
export function emptyMetadata() {
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
        directors: null,
        cast: null,
        trailers: null,
    });
}
export function parseProviderRecord(value: unknown): TProviderRecord {
    const parsed = providerRecordSchema.safeParse(value);
    if (!parsed.success) throw new MovieProviderError('INVALID_RESPONSE');
    return parsed.data;
}

export const MOVIE_PROVIDER = Symbol('MOVIE_PROVIDER');
export interface IMovieLookup {
    movieId: string;
    externalIds: TMovieExternalId[];
    locale: 'en-US';
    allowStale: boolean;
    forceRefresh: boolean;
}
export interface IMovieProvider {
    configurationKey: string;
    search(input: TMovieSearch): Promise<TProviderSearch>;
    details(input: IMovieLookup): Promise<TProviderRecord>;
}
export class MovieProviderError extends Error {
    constructor(
        public reason: TMovieProviderReason,
        public retryAt?: Date,
        public source?: TMovieSource,
        public removals: TSourceRemoval[] = [],
    ) {
        super(`Movie provider: ${reason}`);
    }
}
export function canUseStale(reason: TMovieProviderReason): boolean {
    return ['TIMEOUT', 'RATE_LIMITED', 'UNAVAILABLE'].includes(reason);
}
