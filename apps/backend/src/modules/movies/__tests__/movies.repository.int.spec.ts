import { randomBytes, randomInt } from 'node:crypto';

import { movieDetailsSchema, type TMovieSource } from '@pickflick/contracts';

import { PrismaService } from '../../../database/prisma.service.js';
import { loadIntegrationEnvironment } from '../../../testing/integration.js';
import { buildMovieDetails } from '../../../testing/movie-fixtures.js';
import { MoviesRepository } from '../movies.repository.js';
import { toProviderRecord, type TProviderRecord } from '../providers/movie-provider.js';

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
        const record = buildMovieDetails(value, at.toISOString());
        return toProviderRecord({
            source,
            locale: 'en-US',
            fetchedAt: at.toISOString(),
            similarExternalIds: null,
            data: record.data,
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
        const cached = await repository.findCachedSearch(searchKey);
        const id = cached?.data.movies[0]?.id;
        if (!id) throw new Error('Missing canonical identity');
        if (!ownedIds.includes(id)) ownedIds.push(id);
        return id;
    }
    beforeAll(() => {
        prisma = new PrismaService(loadIntegrationEnvironment());
        repository = new MoviesRepository(prisma);
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
        expect((await repository.findCachedDetails(id, detailKey))?.data.id).toBe(id);
    });
    it('should use the validated detail-cache poster after search cache expiry', async () => {
        const record = fixture();
        const id = await ingest(record);
        const detailKey = key();
        await repository.saveDetails(id, detailKey, record, time);
        await prisma.movieSearchCache.deleteMany({ where: { key: { in: searchKeys } } });
        expect(await repository.findCachedPoster(id, 'tmdb', detailKey)).toBe(
            record.data.posterUrl,
        );
        expect(await repository.findCachedPoster(id, 'tmdb', key())).toBeNull();
        expect((await repository.findCachedMetadata([id], detailKey)).get(id)?.runtime).toBe(120);
    });
    it('should resolve the newest validated search poster from the active source', async () => {
        const record = fixture(time, 'poiskkino');
        const id = await ingest(record);
        expect(await repository.findCachedPoster(id, 'poiskkino')).toBe(record.data.posterUrl);
        expect(await repository.findCachedPoster(id, 'tmdb')).toBeNull();
        const posterUrl = 'https://avatars.mds.yandex.net/get-kinopoisk-image/100/poster/orig';
        const searchKey = key();
        await repository.saveSearch(
            searchKey,
            search([{ ...record, data: { ...record.data, posterUrl } }]),
            later,
        );
        expect(await repository.findCachedPoster(id, 'poiskkino')).toBe(posterUrl);
        await prisma.movieSearchCache.update({
            where: { key: searchKey },
            data: {
                data: {
                    movies: [
                        {
                            id,
                            posterUrl: 'http://127.0.0.1/private.jpg',
                            provenance: [{ source: 'poiskkino' }],
                        },
                    ],
                },
            },
        });
        expect(await repository.findCachedPoster(id, 'poiskkino')).toBeNull();
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
        expect((await repository.findCachedDetails(id, firstKey))?.data.id).toBe(id);
        expect((await repository.findCachedDetails(id, secondKey))?.data.id).toBe(id);
        expect(
            (await repository.findExternalIds(id))?.externalIds.map((id) => id.source).toSorted(),
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
        expect((await repository.findCachedDetails(id, detailKey))?.data.similarMovieIds).toEqual([
            relatedId,
        ]);
    });
    it('should retain valid search results when a duplicate has contradictory source IDs', async () => {
        const original = fixture(time, 'poiskkino');
        const duplicate = fixture(time, 'poiskkino', original.externalIds[1]!.externalId);
        const unrelated = fixture();
        const searchKey = key();
        const result = await repository.saveSearch(
            searchKey,
            search([original, duplicate, unrelated]),
            time,
        );
        ownedIds.push(...result.movies.map((movie) => movie.id));
        expect(result.movies).toHaveLength(2);
        expect((await repository.findCachedSearch(searchKey))?.data).toEqual(result);
        expect(await prisma.movieExternalId.count({ where: duplicate.externalIds[0]! })).toBe(0);
        expect(await ingest(original)).toBe(result.movies[0]!.id);
    });
    it('should skip a conflict without changing summaries or adding earlier source mappings', async () => {
        const original = fixture(time, 'poiskkino');
        const id = await ingest(original);
        const conflicting = fixture(time, 'poiskkino', original.externalIds[1]!.externalId);
        const tmdbId = String(randomInt(10000000, 2000000000));
        const unrelated = fixture();
        const result = await repository.saveSearch(
            key(),
            search([
                {
                    ...conflicting,
                    externalIds: [
                        { source: 'tmdb', externalId: tmdbId },
                        ...conflicting.externalIds,
                    ],
                    data: { ...conflicting.data, title: 'Conflicting title' },
                },
                unrelated,
            ]),
            time,
        );
        ownedIds.push(...result.movies.map((movie) => movie.id));
        expect(result.movies).toHaveLength(1);
        expect((await prisma.movie.findUnique({ where: { id } }))?.title).toBe(original.data.title);
        expect(
            await prisma.movieExternalId.count({ where: { source: 'tmdb', externalId: tmdbId } }),
        ).toBe(0);
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
        expect((await repository.findCachedDetails(id, detailKey))?.fetchedAt).toEqual(earlier);
    });
    it('should treat a search-only Movie as incomplete for details', async () => {
        const id = await ingest(fixture());
        expect(await repository.findCachedDetails(id, key())).toBeNull();
    });
    it('should keep Movie summary columns and never erase them with a sparse search', async () => {
        const record = fixture();
        const id = await ingest(record);
        expect(
            await prisma.movie.findUnique({
                where: { id },
                select: { title: true, releaseYear: true },
            }),
        ).toEqual({ title: record.data.title, releaseYear: record.data.releaseYear });
        await repository.saveSearch(
            key(),
            search([{ ...record, data: { ...record.data, title: null, originalTitle: null } }]),
            later,
        );
        expect((await prisma.movie.findUnique({ where: { id } }))?.title).toBe(record.data.title);
    });
    it('should treat a cached row that no longer fits the schema as a miss', async () => {
        const record = fixture();
        const id = await ingest(record);
        const detailKey = key();
        await repository.saveDetails(id, detailKey, record, time);
        const data = (await repository.findCachedDetails(id, detailKey))!.data;
        await prisma.movieDetailsCache.update({
            where: { movieId_key: { movieId: id, key: detailKey } },
            data: { data: { ...data, posterUrl: 'https://evil.invalid/film.jpg' } },
        });
        expect(await repository.findCachedDetails(id, detailKey)).toBeNull();
        expect(movieDetailsSchema.safeParse(data).success).toBe(true);
    });
    it('should enforce one external ID per source in the database', async () => {
        const record = fixture();
        const id = await ingest(record);
        await expect(
            prisma.movieExternalId.create({
                data: { movieId: id, source: 'tmdb', externalId: '9999999999999' },
            }),
        ).rejects.toThrow('MovieExternalId_movieId_source_key');
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
