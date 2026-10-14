import type { TMovieExternalId, TMovieSearch } from '@pickflick/contracts';

import {
    createEmptyMetadata,
    type IMovieLookup,
    type IMovieProvider,
    MovieProviderError,
    parseProviderRecord,
    toProviderRecord,
    type TProviderRecord,
    type TSourceSnapshot,
} from './movie-provider.js';
import type { PoiskkinoClient } from './poiskkino.client.js';
import type { ThetvdbClient } from './thetvdb.client.js';

interface ILoaded {
    record: TSourceSnapshot | null;
    error: MovieProviderError | null;
}

/** PoiskKino supplies search, media, ratings and related titles; TheTVDB adds English text. */
export class CompositeMovieProvider implements IMovieProvider {
    constructor(
        private poiskkino: Pick<PoiskkinoClient, 'search' | 'details'>,
        private thetvdb: Pick<ThetvdbClient, 'details'>,
    ) {}

    async search(input: TMovieSearch) {
        const result = await this.poiskkino.search(input);
        return { ...result, movies: result.movies.map(toProviderRecord) };
    }

    async details(input: IMovieLookup): Promise<TProviderRecord> {
        const primary = await this.loadPrimary(input.externalIds);
        const ids = combineIds(input.externalIds, primary.record?.externalIds ?? []);
        const enrichment = await load(() => this.thetvdb.details(ids));
        if (!primary.record && !enrichment.record) {
            throw primary.error ?? enrichment.error ?? new MovieProviderError('NOT_FOUND');
        }
        return parseProviderRecord({
            externalIds: combineIds(
                primary.record?.externalIds ?? input.externalIds,
                enrichment.record?.externalIds ?? [],
            ),
            data: mergeMetadata(primary.record, enrichment.record),
            similarExternalIds: primary.record?.similarExternalIds ?? null,
            provenance: [
                {
                    source: 'poiskkino',
                    fetchedAt: primary.record?.fetchedAt ?? null,
                    reason: primary.error?.reason ?? null,
                    sections: ['metadata', 'media', 'ratings', 'similar'],
                },
                {
                    source: 'thetvdb',
                    fetchedAt: enrichment.record?.fetchedAt ?? null,
                    reason: enrichment.error?.reason ?? null,
                    sections: ['metadata'],
                },
            ],
        });
    }

    /** A Movie PoiskKino no longer knows can still be described by TheTVDB. */
    private async loadPrimary(ids: TMovieExternalId[]): Promise<ILoaded> {
        const loaded = await load(() => this.poiskkino.details(ids));
        if (loaded.error && !['NOT_FOUND', 'MISSING_EXTERNAL_ID'].includes(loaded.error.reason)) {
            throw loaded.error;
        }
        return loaded;
    }
}

async function load(fetchSnapshot: () => Promise<TSourceSnapshot>): Promise<ILoaded> {
    try {
        return { record: await fetchSnapshot(), error: null };
    } catch (error) {
        if (!(error instanceof MovieProviderError)) throw error;
        return { record: null, error };
    }
}

/** English text comes from TheTVDB; media, ratings and year stay with PoiskKino. */
function mergeMetadata(primary: TSourceSnapshot | null, enrichment: TSourceSnapshot | null) {
    const base = primary?.data ?? createEmptyMetadata();
    const english = enrichment?.data;
    return {
        ...base,
        title: english?.title ?? base.title,
        overview: english?.overview ?? null,
        originalTitle: english?.originalTitle ?? base.originalTitle,
        releaseDate: english?.releaseDate ?? base.releaseDate,
        originalLanguage: english?.originalLanguage ?? base.originalLanguage,
        runtime: english?.runtime ?? base.runtime,
        genres: english?.genres ?? null,
        directors: english?.directors ?? null,
        cast: english?.cast ?? null,
    };
}

/** Two sources may agree on an ID or add a new one; a different ID for one source is a conflict. */
function combineIds(left: TMovieExternalId[], right: TMovieExternalId[]): TMovieExternalId[] {
    const ids = new Map(left.map((id) => [id.source, id]));
    for (const id of right) {
        if (ids.has(id.source) && ids.get(id.source)?.externalId !== id.externalId)
            throw new MovieProviderError('IDENTITY_CONFLICT');
        ids.set(id.source, id);
    }
    return [...ids.values()];
}
