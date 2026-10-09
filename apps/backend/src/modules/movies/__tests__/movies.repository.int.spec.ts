import { randomBytes, randomInt } from 'node:crypto';

import { movieSummarySchema } from '@pickflick/contracts';

import { PrismaService } from '../../../database/prisma.service.js';
import { integrationEnvironment } from '../../../testing/integration.js';
import { movieDetails } from '../../../testing/movie-fixtures.js';
import { MoviesRepository } from '../movies.repository.js';

describe('MoviesRepository', () => {
    let prisma: PrismaService;
    let repository: MoviesRepository;
    const movieIds: number[] = [];
    const searchKeys: string[] = [];

    function fixture() {
        const tmdbId = randomInt(1_000_000, 2_000_000_000);
        movieIds.push(tmdbId);
        return movieDetails(tmdbId);
    }

    function key(): string {
        const value = randomBytes(32).toString('hex');
        searchKeys.push(value);
        return value;
    }

    beforeAll(() => {
        prisma = new PrismaService(integrationEnvironment());
        repository = new MoviesRepository(prisma);
    });

    afterAll(async () => {
        await prisma.movieSearchCache.deleteMany({ where: { key: { in: searchKeys } } });
        await prisma.movie.deleteMany({ where: { tmdbId: { in: movieIds } } });
        await prisma.$disconnect();
    });

    it('should deduplicate concurrent search and details to one canonical identity', async () => {
        const data = fixture();
        const searchKey = key();
        const fetchedAt = new Date();
        const search = {
            movies: [movieSummarySchema.strip().parse(data)],
            page: 1,
            totalPages: 1,
            totalResults: 1,
        };

        await Promise.all(
            Array.from({ length: 20 }, (_value, index) =>
                index % 2
                    ? repository.saveDetails(data, fetchedAt)
                    : repository.saveSearch(searchKey, search, fetchedAt),
            ),
        );

        expect(await prisma.movie.count({ where: { tmdbId: data.tmdbId } })).toBe(1);
        expect(await repository.cachedDetails(data.tmdbId)).toEqual({ data, fetchedAt });
        expect(await repository.cachedSearch(searchKey)).toEqual({ data: search, fetchedAt });
    });

    it('should preserve newer metadata when an older request finishes later', async () => {
        const data = fixture();
        const newer = new Date('2026-10-09T12:00:00Z');
        const older = new Date('2026-10-08T12:00:00Z');
        await repository.saveDetails({ ...data, title: 'New title' }, newer);
        const row = await prisma.movie.findUniqueOrThrow({ where: { tmdbId: data.tmdbId } });
        await repository.saveDetails({ ...data, title: 'Old title' }, older);

        expect(await repository.cachedDetails(data.tmdbId)).toMatchObject({
            data: { title: 'New title' },
            fetchedAt: newer,
        });
        expect((await prisma.movie.findUniqueOrThrow({ where: { tmdbId: data.tmdbId } })).id).toBe(
            row.id,
        );
    });

    it('should never let search summary freshness imply fresh details', async () => {
        const data = fixture();
        const older = new Date('2026-10-08T12:00:00Z');
        const newer = new Date('2026-10-09T12:00:00Z');
        await repository.saveDetails(data, older);
        await repository.saveSearch(
            key(),
            {
                movies: [{ ...movieSummarySchema.strip().parse(data), title: 'Search title' }],
                page: 1,
                totalPages: 1,
                totalResults: 1,
            },
            newer,
        );

        expect(await repository.cachedDetails(data.tmdbId)).toEqual({ data, fetchedAt: older });
        expect(
            (await prisma.movie.findUniqueOrThrow({ where: { tmdbId: data.tmdbId } }))
                .summaryFetchedAt,
        ).toEqual(newer);
    });

    it('should treat a search-only Movie as incomplete for detail callers', async () => {
        const data = fixture();
        await repository.saveSearch(
            key(),
            {
                movies: [movieSummarySchema.strip().parse(data)],
                page: 1,
                totalPages: 1,
                totalResults: 1,
            },
            new Date(),
        );
        expect(await repository.cachedDetails(data.tmdbId)).toBeNull();
    });

    it('should invalidate details and search snapshots after provider removal', async () => {
        const data = fixture();
        const searchKey = key();
        const earlier = new Date('2026-10-08T12:00:00Z');
        const removedAt = new Date('2026-10-09T12:00:00Z');
        await repository.saveDetails(data, earlier);
        await repository.saveSearch(
            searchKey,
            {
                movies: [movieSummarySchema.strip().parse(data)],
                page: 1,
                totalPages: 1,
                totalResults: 1,
            },
            earlier,
        );
        await repository.markUnavailable(data.tmdbId, removedAt);
        await repository.saveDetails(data, earlier);

        expect(await repository.cachedDetails(data.tmdbId)).toBeNull();
        expect(await repository.cachedSearch(searchKey)).toBeNull();
        await repository.saveDetails(data, new Date(removedAt.getTime() + 1000));
        expect(await repository.cachedDetails(data.tmdbId)).not.toBeNull();
    });

    it('should reject unsafe persisted provider payloads', async () => {
        const data = fixture();
        await repository.saveDetails(data, new Date());
        await prisma.movie.update({
            where: { tmdbId: data.tmdbId },
            data: { details: { ...data, posterPath: '//evil.invalid/film.jpg' } },
        });
        expect(await repository.cachedDetails(data.tmdbId)).toBeNull();
    });

    it('should retain first-ingestion removal and never weaken its observation time', async () => {
        const data = fixture();
        const older = new Date('2026-10-08T12:00:00Z');
        const removedAt = new Date('2026-10-09T12:00:00Z');
        await repository.markUnavailable(data.tmdbId, removedAt);
        await repository.markUnavailable(data.tmdbId, older);
        await repository.saveDetails(data, older);
        expect(await repository.cachedDetails(data.tmdbId)).toBeNull();
        expect(
            (await prisma.movie.findUniqueOrThrow({ where: { tmdbId: data.tmdbId } }))
                .unavailableAt,
        ).toEqual(removedAt);
        await repository.saveDetails(data, new Date(removedAt.getTime() + 1000));
        expect(await repository.cachedDetails(data.tmdbId)).not.toBeNull();
    });

    it('should reject a cached payload associated with a different Movie identity', async () => {
        const data = fixture();
        await repository.saveDetails(data, new Date());
        await prisma.movie.update({
            where: { tmdbId: data.tmdbId },
            data: { details: { ...data, tmdbId: data.tmdbId + 1 } },
        });
        expect(await repository.cachedDetails(data.tmdbId)).toBeNull();
    });

    it('should enforce detail completeness in the database', async () => {
        const data = fixture();
        await repository.saveDetails(data, new Date());
        await expect(
            prisma.movie.update({
                where: { tmdbId: data.tmdbId },
                data: { detailsFetchedAt: null },
            }),
        ).rejects.toThrow();
        expect(await repository.cachedDetails(data.tmdbId)).not.toBeNull();
    });

    it('should avoid deadlocks when overlapping searches return opposite Movie orders', async () => {
        const movies = [fixture(), fixture()].map((movie) =>
            movieSummarySchema.strip().parse(movie),
        );
        const fetchedAt = new Date();
        await Promise.all([
            repository.saveSearch(
                key(),
                { movies, page: 1, totalPages: 1, totalResults: 2 },
                fetchedAt,
            ),
            repository.saveSearch(
                key(),
                { movies: [...movies].reverse(), page: 1, totalPages: 1, totalResults: 2 },
                fetchedAt,
            ),
        ]);
        expect(
            await prisma.movie.count({
                where: { tmdbId: { in: movies.map(({ tmdbId }) => tmdbId) } },
            }),
        ).toBe(2);
    });
});
