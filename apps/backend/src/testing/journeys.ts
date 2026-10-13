import { randomUUID } from 'node:crypto';

import { loadRuntimeEnvironment } from '@pickflick/config/environment';
import type { TMovieSearchResults } from '@pickflick/contracts';
import {
    assertSafeSeedOrResetTarget,
    createDatabaseClient,
    type PrismaClient,
} from '@pickflick/database';
import { testUtils } from 'better-auth/plugins';

import { createAuth } from '../modules/auth/auth.config.js';
import { catalogCacheKey } from '../modules/movies/catalog-cache-key.js';

interface IBrowserCookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'Lax' | 'Strict' | 'None';
    expires?: number;
}

interface IJourneyMovie {
    id: string;
    title: string;
    releaseYear: number;
}

/**
 * Database access for browser journeys against the real API. Sessions come from Better Auth's own
 * test plugin in the test process, so the running API exposes no test-only sign-in.
 */
export interface IJourneyBackend {
    createUser(displayName: string): Promise<string>;
    /** Session cookies for a User, signed with the API's secret for the given cookie domain. */
    cookiesFor(userId: string, domain: string): Promise<IBrowserCookie[]>;
    /** Stores a fresh catalog search so the API answers it without a provider. */
    seedMovieSearch(query: string, movies: IJourneyMovie[]): Promise<void>;
    close(): Promise<void>;
}

export async function connectJourneyBackend(): Promise<IJourneyBackend> {
    const environment = loadRuntimeEnvironment();
    assertSafeSeedOrResetTarget(environment);
    const prisma = createDatabaseClient(environment.databaseUrl);
    const auth = createAuth(environment, prisma, [testUtils()]);
    const context = (await auth.$context) as unknown as {
        test: {
            getCookies(input: { userId: string; domain: string }): Promise<IBrowserCookie[]>;
        };
    };
    return {
        createUser: (displayName) => createUser(prisma, displayName),
        cookiesFor: (userId, domain) => context.test.getCookies({ userId, domain }),
        seedMovieSearch: (query, movies) =>
            seedMovieSearch(
                prisma,
                catalogCacheKey(environment.catalog.provider, 'en-US', query, 1),
                movies,
            ),
        close: () => prisma.$disconnect(),
    };
}

async function createUser(prisma: PrismaClient, displayName: string): Promise<string> {
    const id = randomUUID();
    await prisma.user.create({
        data: { id, email: `journey-${id}@example.invalid`, emailVerified: true, displayName },
    });
    return id;
}

async function seedMovieSearch(
    prisma: PrismaClient,
    key: string,
    movies: IJourneyMovie[],
): Promise<void> {
    const fetchedAt = new Date();
    for (const { id, title, releaseYear } of movies) {
        await prisma.movie.upsert({
            where: { id },
            create: { id, title, releaseYear },
            update: { title, releaseYear },
        });
    }
    const data: TMovieSearchResults = {
        movies: movies.map(({ id, title, releaseYear }) => ({
            id,
            title,
            originalTitle: null,
            overview: null,
            releaseDate: null,
            releaseYear,
            adult: false,
            originalLanguage: 'en',
            posterUrl: null,
            backdropUrl: null,
            ratings: [],
            provenance: [
                {
                    source: 'tmdb',
                    fetchedAt: fetchedAt.toISOString(),
                    reason: null,
                    sections: ['metadata'],
                },
            ],
        })),
        page: 1,
        totalPages: 1,
        totalResults: movies.length,
    };
    await prisma.movieSearchCache.upsert({
        where: { key },
        create: { key, data, fetchedAt },
        update: { data, fetchedAt },
    });
}
