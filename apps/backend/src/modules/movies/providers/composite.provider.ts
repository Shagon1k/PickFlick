import type { TMovieExternalId, TMovieSearch } from '@pickflick/contracts';

import {
    canUseStale,
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

/** PoiskKino supplies search/ratings/related titles; TheTVDB adds English text and posters. */
export class CompositeMovieProvider implements IMovieProvider {
    constructor(
        private poiskkino: Pick<PoiskkinoClient, 'search' | 'fetchDetails'>,
        private thetvdb: Pick<ThetvdbClient, 'fetchDetails'>,
    ) {}

    async search(input: TMovieSearch) {
        const result = await this.poiskkino.search(input);
        return { ...result, movies: result.movies.map(toProviderRecord) };
    }

    async fetchDetails(input: IMovieLookup): Promise<TProviderRecord> {
        const primary = await this.loadPrimary(input.externalIds);
        const ids = combineIds(input.externalIds, primary.record?.externalIds ?? []);
        const enrichment = await load(() => this.thetvdb.fetchDetails(ids));
        if (!primary.record && !enrichment.record) {
            // A TheTVDB outage must not turn a PoiskKino 404 into "unavailable": a stale cache still serves.
            const outage =
                enrichment.error && canUseStale(enrichment.error.reason) ? enrichment.error : null;
            throw (
                outage ?? primary.error ?? enrichment.error ?? new MovieProviderError('NOT_FOUND')
            );
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
                    sections: ['metadata', 'media'],
                },
            ],
        });
    }

    /** A Movie PoiskKino no longer knows can still be described by TheTVDB. */
    private async loadPrimary(ids: TMovieExternalId[]): Promise<ILoaded> {
        const loaded = await load(() => this.poiskkino.fetchDetails(ids));
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

/**
 * Prefer TheTVDB's English metadata, poster and English trailers; keep PoiskKino ratings, and fall back
 * to its English-named credits, dollar amounts and trailers where TheTVDB has none.
 */
function mergeMetadata(primary: TSourceSnapshot | null, enrichment: TSourceSnapshot | null) {
    const base = primary?.data ?? createEmptyMetadata();
    const english = enrichment?.data;
    return {
        ...base,
        title: english?.title ?? base.title,
        posterUrl: english?.posterUrl ?? base.posterUrl,
        overview: english?.overview ?? null,
        originalTitle: english?.originalTitle ?? base.originalTitle,
        releaseDate: english?.releaseDate ?? base.releaseDate,
        originalLanguage: english?.originalLanguage ?? base.originalLanguage,
        runtime: english?.runtime ?? base.runtime,
        genres: english?.genres ?? null,
        productionCountries: english?.productionCountries ?? null,
        directors: english?.directors ?? base.directors,
        writers: english?.writers ?? base.writers,
        cast: english?.cast ?? base.cast,
        trailers: english?.trailers ?? base.trailers,
        budget: english?.budget ?? base.budget,
        revenue: english?.revenue ?? base.revenue,
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
