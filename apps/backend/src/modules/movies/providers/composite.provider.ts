import type { TMovieExternalId, TMovieSearch } from '@pickflick/contracts';

import type { MoviesRepository } from '../movies.repository.js';
import {
    canUseStale,
    emptyMetadata,
    type IMovieLookup,
    type IMovieProvider,
    MovieProviderError,
    parseProviderRecord,
    singleSource,
    type TProviderRecord,
    type TSourceSnapshot,
} from './movie-provider.js';
import type { PoiskkinoClient } from './poiskkino.client.js';
import type { ThetvdbClient } from './thetvdb.client.js';

export class CompositeMovieProvider implements IMovieProvider {
    get configurationKey() {
        return `composite:v1:${this.poiskkino.configurationKey}:${this.thetvdb.configurationKey}`;
    }
    constructor(
        private poiskkino: Pick<
            PoiskkinoClient,
            'search' | 'details' | 'configurationKey' | 'enabled'
        >,
        private thetvdb: Pick<ThetvdbClient, 'details' | 'configurationKey' | 'enabled'>,
        private policy: { refreshHours: number; staleHours: number },
        private cache: Pick<MoviesRepository, 'cachedSources'>,
    ) {}
    async search(input: TMovieSearch) {
        const result = await this.poiskkino.search(input);
        return { ...result, movies: result.movies.map(singleSource) };
    }
    async details(input: IMovieLookup): Promise<TProviderRecord> {
        const cachedSources = await this.cache.cachedSources(input.movieId, input.locale);
        const { record: primary, error: primaryError } = await this.loadPoiskkino({
            ...input,
            cachedSources,
        });
        const ids = this.combineIds(input.externalIds, primary?.externalIds ?? []);
        const cached = cachedSources.find(
            (snapshot) =>
                snapshot.source === 'thetvdb' &&
                snapshot.locale === input.locale &&
                this.matches(ids, snapshot.externalIds),
        );
        const { record: enrichment, error: enrichmentError } = await this.loadThetvdb(
            input,
            ids,
            cached,
        );
        if (!primary && !enrichment)
            throw primaryError ?? enrichmentError ?? new MovieProviderError('NOT_FOUND');
        const base = primary?.data ?? emptyMetadata();
        const english = enrichment?.data;
        const externalIds = this.combineIds(
            primary?.externalIds ?? input.externalIds,
            enrichment?.externalIds ?? [],
        );
        return parseProviderRecord({
            externalIds,
            data: {
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
            },
            similarExternalIds: primary?.similarExternalIds ?? null,
            snapshots: [...(primary ? [primary] : []), ...(enrichment ? [enrichment] : [])],
            provenance: [
                {
                    source: 'poiskkino',
                    fetchedAt: primary?.fetchedAt ?? null,
                    reason: primaryError?.reason ?? null,
                    sections: ['metadata', 'media', 'ratings', 'similar'],
                },
                {
                    source: 'thetvdb',
                    fetchedAt: enrichment?.fetchedAt ?? null,
                    reason: enrichmentError?.reason ?? null,
                    sections: ['metadata'],
                },
            ],
        });
    }
    private async loadPoiskkino(input: IMovieLookup & { cachedSources: TSourceSnapshot[] }) {
        const cached = input.cachedSources.find(
            (snapshot) =>
                snapshot.source === 'poiskkino' &&
                snapshot.locale === input.locale &&
                this.matches(input.externalIds, snapshot.externalIds),
        );
        if (
            this.poiskkino.enabled &&
            !input.forceRefresh &&
            cached &&
            this.within(cached.fetchedAt, this.policy.refreshHours)
        )
            return { record: cached, error: null };
        try {
            return { record: await this.poiskkino.details(input.externalIds), error: null };
        } catch (error) {
            if (
                !(error instanceof MovieProviderError) ||
                !['NOT_FOUND', 'MISSING_EXTERNAL_ID'].includes(error.reason)
            )
                throw error;
            return { record: null, error };
        }
    }
    private async loadThetvdb(
        input: IMovieLookup,
        ids: TMovieExternalId[],
        cached: TSourceSnapshot | undefined,
    ) {
        if (
            this.thetvdb.enabled &&
            !input.forceRefresh &&
            cached &&
            this.within(cached.fetchedAt, this.policy.refreshHours)
        )
            return { record: cached, error: null };
        try {
            return { record: await this.thetvdb.details(ids), error: null };
        } catch (error) {
            if (!(error instanceof MovieProviderError)) throw error;
            const record =
                input.allowStale &&
                canUseStale(error.reason) &&
                cached &&
                this.within(cached.fetchedAt, this.policy.staleHours)
                    ? cached
                    : null;
            return { record, error };
        }
    }
    private combineIds(left: TMovieExternalId[], right: TMovieExternalId[]) {
        const ids = new Map(left.map((id) => [id.source, id]));
        for (const id of right) {
            if (ids.has(id.source) && ids.get(id.source)?.externalId !== id.externalId)
                throw new MovieProviderError('IDENTITY_CONFLICT');
            ids.set(id.source, id);
        }
        return [...ids.values()];
    }
    private matches(left: TMovieExternalId[], right: TMovieExternalId[]) {
        return (
            left.some((id) =>
                right.some(
                    (other) => id.source === other.source && id.externalId === other.externalId,
                ),
            ) &&
            !left.some((id) =>
                right.some(
                    (other) => id.source === other.source && id.externalId !== other.externalId,
                ),
            )
        );
    }
    private within(date: string, hours: number) {
        const age = Date.now() - Date.parse(date);
        return age >= 0 && age < hours * 3600000;
    }
}
