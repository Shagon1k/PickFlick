import { legalDocuments } from '#app/(marketing)/legal/[document]/legal-content';
import robots from '#app/robots';
import sitemap from '#app/sitemap';
import {
    CANONICAL_ORIGIN,
    INDEXABLE_PUBLIC_ROUTES,
    NOINDEX_HEADER,
    NON_PUBLIC_INDEXING_BOUNDARIES,
} from '#lib/indexing';
import { createPublicMetadata, rootMetadata } from '#lib/public-metadata';

import nextConfig from '../../../next.config';

describe('public indexing boundaries', () => {
    it('should require routes to opt into indexing', () => {
        expect(rootMetadata.robots).toMatchObject({
            follow: false,
            index: false,
            noarchive: true,
        });
    });

    it('should build canonical and social metadata for an approved public route', () => {
        const metadata = createPublicMetadata({
            description: 'Public description',
            path: '/legal/privacy',
            title: 'Privacy Notice — PickFlick',
        });

        expect(rootMetadata.metadataBase).toEqual(new URL(CANONICAL_ORIGIN));
        expect(metadata).toMatchObject({
            alternates: { canonical: '/legal/privacy' },
            openGraph: {
                description: 'Public description',
                title: 'Privacy Notice — PickFlick',
                type: 'website',
                url: '/legal/privacy',
            },
            robots: { follow: true, index: true },
            twitter: {
                card: 'summary_large_image',
                description: 'Public description',
                title: 'Privacy Notice — PickFlick',
            },
        });
        expect(metadata.openGraph?.images).toEqual(metadata.twitter?.images);
    });

    it('should list only approved public routes in the sitemap', () => {
        expect(sitemap().map(({ url }) => url)).toEqual(
            INDEXABLE_PUBLIC_ROUTES.map((path) => new URL(path, CANONICAL_ORIGIN).toString()),
        );
    });

    it('should keep authenticated, token-bearing, admin, and preview routes out of robots', () => {
        const rules = robots().rules;
        expect(Array.isArray(rules)).toBe(false);
        expect(rules).toMatchObject({
            allow: '/',
            disallow: NON_PUBLIC_INDEXING_BOUNDARIES.map(({ robotsPath }) => robotsPath),
            userAgent: '*',
        });
        expect(robots()).toMatchObject({
            host: CANONICAL_ORIGIN,
            sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
        });
    });

    it('should send a noindex response header for every non-public route boundary', async () => {
        const headers = await nextConfig.headers?.();

        expect(headers).toEqual(
            expect.arrayContaining(
                NON_PUBLIC_INDEXING_BOUNDARIES.map(({ headerSource }) => ({
                    headers: [NOINDEX_HEADER],
                    source: headerSource,
                })),
            ),
        );
    });
});

describe('provisional legal entries', () => {
    it.each(Object.values(legalDocuments))('should keep $path visibly provisional', (document) => {
        const copy = document.sections.flatMap(({ body }) => body).join(' ');

        expect(copy).toContain('not the final');
        expect(copy).toMatch(/review/i);
        expect(copy).not.toMatch(/\b\d+\s*(day|week|month|year)s?\b/i);
        expect(copy).not.toMatch(/cookie/i);
    });
});
