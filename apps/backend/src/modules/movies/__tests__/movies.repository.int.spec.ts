import { randomBytes, randomInt, randomUUID } from 'node:crypto';

import { movieDetailsSchema, type TMovieSource } from '@pickflick/contracts';

import { PrismaService } from '../../../database/prisma.service.js';
import { integrationEnvironment } from '../../../testing/integration.js';
import { movieDetails } from '../../../testing/movie-fixtures.js';
import { MoviesRepository } from '../movies.repository.js';
import { MoviesService } from '../movies.service.js';
import { CompositeMovieProvider } from '../providers/composite.provider.js';
import {
    MovieProviderError,
    singleSource,
    type TProviderRecord,
    type TSourceSnapshot,
} from '../providers/movie-provider.js';

describe('MoviesRepository', () => {
    let prisma: PrismaService;
    let repository: MoviesRepository;
    const ownedIds: string[] = [];
    const searchKeys: string[] = [];
    const key = () => {
        const value = randomBytes(32).toString('hex');
        searchKeys.push(value);
        return value;
    };
    const time = new Date('2026-10-09T12:00:00Z');
    const earlier = new Date(time.getTime() - 1000);
    const later = new Date(time.getTime() + 1000);
    function fixture(at = time, source: TMovieSource = 'tmdb', imdb?: string) {
        const value = randomInt(10000000, 2000000000);
        const record = movieDetails(value, at.toISOString());
        return singleSource({
            ...record.snapshots[0]!,
            source,
            externalIds: [
                { source, externalId: String(value) },
                { source: 'imdb', externalId: imdb ?? `tt${value}` },
            ],
        });
    }
    function search(movies: TProviderRecord[]) {
        return { movies, page: 1, totalPages: 1, totalResults: movies.length };
    }
    async function ingest(record: TProviderRecord) {
        const searchKey = key();
        await repository.saveSearch(searchKey, search([record]), time);
        const cached = await repository.cachedSearch(searchKey);
        const id = cached?.data.movies[0]?.id;
        if (!id) throw new Error('Missing canonical identity');
        if (!ownedIds.includes(id)) ownedIds.push(id);
        return id;
    }
    beforeAll(() => {
        prisma = new PrismaService(integrationEnvironment());
        repository = new MoviesRepository(prisma, integrationEnvironment());
    });
    afterAll(async () => {
        await prisma.movieSearchCache.deleteMany({ where: { key: { in: searchKeys } } });
        await prisma.movie.deleteMany({ where: { id: { in: ownedIds } } });
        await prisma.$disconnect();
    });
    it('should deduplicate concurrent ingestion across sources through verified IMDb', async () => {
        const imdb = `tt${randomInt(10000000, 2000000000)}`;
        const tmdb = fixture(time, 'tmdb', imdb);
        const poisk = fixture(time, 'poiskkino', imdb);
        await Promise.all(
            Array.from({ length: 20 }, (_value, index) =>
                repository.saveSearch(key(), search([index % 2 ? poisk : tmdb]), time),
            ),
        );
        const mappings = await prisma.movieExternalId.findMany({
            where: { OR: [...tmdb.externalIds, ...poisk.externalIds] },
        });
        const ids = [...new Set(mappings.map((mapping) => mapping.movieId))];
        ownedIds.push(...ids);
        expect(ids).toHaveLength(1);
        const id = ids[0]!;
        const detailKey = key();
        await Promise.all(
            Array.from({ length: 10 }, () => repository.saveDetails(id, detailKey, tmdb, time)),
        );
        expect((await repository.cachedDetails(id, detailKey))?.data.id).toBe(id);
    });
    it('should retain UUID when provider configuration and external identities change', async () => {
        const original = fixture();
        const id = await ingest(original);
        const imdb = original.externalIds.find((id) => id.source === 'imdb')!.externalId;
        const switched = fixture(later, 'poiskkino', imdb);
        expect(await ingest(switched)).toBe(id);
        const firstKey = key();
        const secondKey = key();
        await repository.saveDetails(id, firstKey, original, time);
        await repository.saveDetails(id, secondKey, switched, later);
        expect((await repository.cachedDetails(id, firstKey))?.data.id).toBe(id);
        expect((await repository.cachedDetails(id, secondKey))?.data.id).toBe(id);
        expect(
            (await repository.lookup(id))?.externalIds.map((id) => id.source).toSorted(),
        ).toEqual(['imdb', 'poiskkino', 'tmdb']);
    });
    it('should keep identical titles and release years separate without a shared external ID', async () => {
        const left = fixture();
        const right = fixture(time, 'poiskkino');
        expect(left.data.title).toBe(right.data.title);
        expect(left.data.releaseYear).toBe(right.data.releaseYear);
        expect(await ingest(left)).not.toBe(await ingest(right));
    });
    it('should reject contradictory external IDs without merging existing UUIDs', async () => {
        const left = fixture();
        const right = fixture();
        const leftId = await ingest(left);
        const rightId = await ingest(right);
        await expect(
            repository.saveSearch(
                key(),
                search([{ ...left, externalIds: [left.externalIds[0]!, right.externalIds[1]!] }]),
                time,
            ),
        ).rejects.toMatchObject({ reason: 'IDENTITY_CONFLICT' });
        expect(await prisma.movie.count({ where: { id: { in: [leftId, rightId] } } })).toBe(2);
    });
    it('should resolve related titles to canonical UUIDs', async () => {
        const record = fixture();
        const related = fixture(time, 'poiskkino');
        const relatedId = await ingest(related);
        const id = await ingest(record);
        const detailKey = key();
        await repository.saveDetails(
            id,
            detailKey,
            { ...record, similarExternalIds: [related.externalIds] },
            time,
        );
        expect((await repository.cachedDetails(id, detailKey))?.data.similarMovieIds).toEqual([
            relatedId,
        ]);
    });
    it('should preserve newer metadata when an older request finishes later', async () => {
        const record = fixture(later);
        const id = await ingest(record);
        const detailKey = key();
        await repository.saveDetails(id, detailKey, record, later);
        const old = singleSource({
            ...record.snapshots[0]!,
            fetchedAt: earlier.toISOString(),
            data: { ...record.data, title: 'Older' },
        });
        await repository.saveDetails(id, detailKey, old, earlier);
        expect((await repository.cachedDetails(id, detailKey))?.data.title).toBe(record.data.title);
        expect((await repository.cachedSources(id, 'en-US'))[0]?.fetchedAt).toBe(
            later.toISOString(),
        );
    });
    it('should never let search summary freshness refresh details', async () => {
        const record = fixture(earlier);
        const id = await ingest(record);
        const detailKey = key();
        await repository.saveDetails(id, detailKey, record, earlier);
        await repository.saveSearch(
            key(),
            search([fixture(later, 'poiskkino', record.externalIds[1]!.externalId)]),
            later,
        );
        expect((await repository.cachedDetails(id, detailKey))?.fetchedAt).toEqual(earlier);
    });
    it('should treat a search-only Movie as incomplete for details', async () => {
        const id = await ingest(fixture());
        expect(await repository.cachedDetails(id, key())).toBeNull();
        expect(await repository.cachedSources(id, 'en-US')).toEqual([]);
    });
    it('should retain independent source clocks after primary refresh', async () => {
        const primary = fixture(later, 'poiskkino');
        const id = await ingest(primary);
        const english = fixture(earlier, 'thetvdb', primary.externalIds[1]!.externalId);
        const detailKey = key();
        await repository.saveDetails(
            id,
            detailKey,
            {
                ...primary,
                externalIds: [...primary.externalIds, english.externalIds[0]!],
                snapshots: [...primary.snapshots, ...english.snapshots],
                provenance: [...primary.provenance, ...english.provenance],
            },
            later,
        );
        const cachedSources = await repository.cachedSources(id, 'en-US');
        expect(cachedSources.find((source) => source.source === 'thetvdb')?.fetchedAt).toBe(
            earlier.toISOString(),
        );
        expect(cachedSources.find((source) => source.source === 'poiskkino')?.fetchedAt).toBe(
            later.toISOString(),
        );
    });
    it('should remove one source while retaining another source and the Movie UUID', async () => {
        const primary = fixture(earlier, 'poiskkino');
        const id = await ingest(primary);
        const english = fixture(earlier, 'thetvdb', primary.externalIds[1]!.externalId);
        await ingest(english);
        await repository.saveDetails(id, key(), english, earlier);
        await repository.markUnavailable(id, 'thetvdb', time);
        const detailKey = key();
        await repository.saveDetails(
            id,
            detailKey,
            {
                ...primary,
                removals: [{ source: 'thetvdb', attemptedAt: time.toISOString() }],
                provenance: [
                    ...primary.provenance,
                    {
                        source: 'thetvdb',
                        fetchedAt: null,
                        reason: 'NOT_FOUND',
                        sections: ['metadata'],
                    },
                ],
            },
            time,
        );
        expect((await repository.cachedDetails(id, detailKey))?.data.id).toBe(id);
        expect(
            (await repository.cachedSources(id, 'en-US')).some(
                (source) => source.source === 'thetvdb',
            ),
        ).toBe(false);
    });
    it('should persist both forced-refresh removals and never reuse either fresh source', async () => {
        const primary = fixture(earlier, 'poiskkino');
        const english = fixture(earlier, 'thetvdb', primary.externalIds[1]!.externalId);
        const id = await ingest(primary);
        const poiskkino = {
            enabled: true,
            configurationKey: 'primary',
            search: vi.fn(),
            details: vi
                .fn<() => Promise<TSourceSnapshot>>()
                .mockResolvedValue(primary.snapshots[0]!),
        };
        const thetvdb = {
            enabled: true,
            configurationKey: 'enrichment',
            details: vi
                .fn<() => Promise<TSourceSnapshot>>()
                .mockResolvedValue(english.snapshots[0]!),
        };
        const environment = integrationEnvironment();
        const provider = new CompositeMovieProvider(
            poiskkino,
            thetvdb,
            environment.catalog,
            repository,
        );
        const service = new MoviesService(provider, repository, environment);
        await service.details(id, { forceRefresh: true });
        poiskkino.details.mockRejectedValue(
            new MovieProviderError('NOT_FOUND', undefined, 'poiskkino', [
                { source: 'poiskkino', attemptedAt: new Date().toISOString() },
            ]),
        );
        thetvdb.details.mockRejectedValue(
            new MovieProviderError('NOT_FOUND', undefined, 'thetvdb', [
                { source: 'thetvdb', attemptedAt: new Date().toISOString() },
            ]),
        );
        expect(await service.details(id, { forceRefresh: true, allowStale: true })).toMatchObject({
            state: 'unavailable',
        });
        expect(await repository.cachedSources(id, 'en-US')).toEqual([]);
        expect(await service.details(id)).toMatchObject({ state: 'unavailable' });
        expect(poiskkino.details).toHaveBeenCalledTimes(3);
        expect(thetvdb.details).toHaveBeenCalledTimes(3);
    });
    it.each([false, true])(
        'should apply later enrichment removal from an earlier service request with primary removed %s',
        async (removePrimary) => {
            const primary = fixture(time, 'poiskkino');
            const english = fixture(time, 'thetvdb', primary.externalIds[1]!.externalId);
            const id = await ingest(primary);
            let releasePrimary!: () => void;
            let primaryStarted!: () => void;
            const started = new Promise<void>((resolve) => {
                primaryStarted = resolve;
            });
            const blocked = new Promise<TSourceSnapshot>((resolve, reject) => {
                releasePrimary = () =>
                    removePrimary
                        ? reject(
                              new MovieProviderError('NOT_FOUND', undefined, 'poiskkino', [
                                  { source: 'poiskkino', attemptedAt: new Date().toISOString() },
                              ]),
                          )
                        : resolve(primary.snapshots[0]!);
            });
            const poiskkino = {
                enabled: true,
                configurationKey: 'primary',
                search: vi.fn(),
                details: vi
                    .fn<() => Promise<TSourceSnapshot>>()
                    .mockImplementationOnce(() => {
                        primaryStarted();
                        return blocked;
                    })
                    .mockResolvedValue(primary.snapshots[0]!),
            };
            const thetvdb = {
                enabled: true,
                configurationKey: 'enrichment',
                details: vi
                    .fn<() => Promise<TSourceSnapshot>>()
                    .mockResolvedValueOnce(english.snapshots[0]!)
                    .mockImplementationOnce(() =>
                        Promise.reject(
                            new MovieProviderError('NOT_FOUND', undefined, 'thetvdb', [
                                { source: 'thetvdb', attemptedAt: new Date().toISOString() },
                            ]),
                        ),
                    ),
            };
            const environment = integrationEnvironment();
            const provider = new CompositeMovieProvider(
                poiskkino,
                thetvdb,
                environment.catalog,
                repository,
            );
            const service = new MoviesService(provider, repository, environment);
            vi.useFakeTimers({ toFake: ['Date'] });
            try {
                vi.setSystemTime(earlier);
                const requestA = service.details(id, { forceRefresh: true });
                await started;
                vi.setSystemTime(time);
                expect(await service.details(id, { forceRefresh: true })).toMatchObject({
                    state: 'fresh',
                });
                vi.setSystemTime(later);
                releasePrimary();
                await requestA;
                expect(
                    (await repository.cachedSources(id, 'en-US')).map(
                        (snapshot) => snapshot.source,
                    ),
                ).not.toContain('thetvdb');
                expect(
                    (
                        await prisma.movieExternalId.findUnique({
                            where: { movieId_source: { movieId: id, source: 'thetvdb' } },
                        })
                    )?.unavailableAt,
                ).toEqual(later);
            } finally {
                vi.useRealTimers();
            }
        },
    );
    it.each([false, true])(
        'should preserve removal at equal timestamps with prior details %s',
        async (ingested) => {
            const record = fixture(earlier);
            const id = await ingest(record);
            const detailKey = key();
            const searchKey = key();
            if (ingested) await repository.saveDetails(id, detailKey, record, earlier);
            await repository.markUnavailable(id, 'tmdb', time);
            const tied = singleSource({ ...record.snapshots[0]!, fetchedAt: time.toISOString() });
            await Promise.all([
                repository.saveDetails(id, detailKey, tied, time),
                repository.saveSearch(searchKey, search([tied]), time),
            ]);
            expect(await repository.cachedDetails(id, detailKey)).toBeNull();
            expect(await repository.cachedSearch(searchKey)).toBeNull();
            const renewed = singleSource({
                ...record.snapshots[0]!,
                fetchedAt: later.toISOString(),
            });
            await repository.saveDetails(id, detailKey, renewed, later);
            expect((await repository.cachedDetails(id, detailKey))?.data.id).toBe(id);
            expect(await repository.cachedSearch(searchKey)).not.toBeNull();
        },
    );
    it('should retain removal before first details and never weaken its timestamp', async () => {
        const record = fixture(earlier);
        const id = await ingest(record);
        const detailKey = key();
        await repository.markUnavailable(id, 'tmdb', time);
        await repository.markUnavailable(id, 'tmdb', earlier);
        await repository.saveDetails(id, detailKey, record, earlier);
        expect(await repository.cachedDetails(id, detailKey)).toBeNull();
        const mapping = await prisma.movieExternalId.findUnique({
            where: { movieId_source: { movieId: id, source: 'tmdb' } },
        });
        expect(mapping?.unavailableAt).toEqual(time);
    });
    it('should reject unsafe cached media and mismatched public UUIDs', async () => {
        const record = fixture();
        const id = await ingest(record);
        const detailKey = key();
        await repository.saveDetails(id, detailKey, record, time);
        const data = (await repository.cachedDetails(id, detailKey))!.data;
        for (const replacement of [
            { ...data, posterUrl: 'https://evil.invalid/film.jpg' },
            { ...data, id: randomUUID() },
        ]) {
            await prisma.movieDetailsCache.update({
                where: { movieId_key: { movieId: id, key: detailKey } },
                data: { data: replacement },
            });
            expect(await repository.cachedDetails(id, detailKey)).toBeNull();
        }
        expect(movieDetailsSchema.safeParse(data).success).toBe(true);
    });
    it('should enforce source-cache completeness and uniqueness in the database', async () => {
        const record = fixture();
        const id = await ingest(record);
        await expect(
            prisma.$executeRaw`INSERT INTO "MovieSourceCache" ("movieId","source","locale","data") VALUES (${id}::uuid,'tmdb','en-US','{}'::jsonb)`,
        ).rejects.toThrow();
        await expect(
            prisma.movieExternalId.create({
                data: { movieId: id, source: 'tmdb', externalId: '9999999999999' },
            }),
        ).rejects.toThrow();
    });
    it('should avoid deadlocks for searches returning opposite movie orders', async () => {
        const records = [fixture(), fixture()];
        await Promise.all([
            repository.saveSearch(key(), search(records), time),
            repository.saveSearch(key(), search([...records].reverse()), time),
        ]);
        const ids = await Promise.all(records.map((record) => ingest(record)));
        expect(new Set(ids).size).toBe(2);
    });
});
