import { describe, expect, it } from 'vitest';

import nextConfig from '../../next.config';
import robots from '../app/robots';
import sitemap from '../app/sitemap';
import { legalDocuments } from '../components/legal/legal-content';
import {
    CANONICAL_ORIGIN,
    INDEXABLE_PUBLIC_ROUTES,
    NOINDEX_HEADER,
    NON_PUBLIC_INDEXING_BOUNDARIES,
} from '../indexing';
import { createPublicMetadata, rootMetadata } from '../public-metadata';

describe('public indexing boundaries', () => {
    it('requires routes to opt into indexing', () => {
        expect(rootMetadata.robots).toMatchObject({
            follow: false,
            index: false,
            noarchive: true,
        });
    });

    it('builds canonical and social metadata for an approved public route', () => {
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

    it('lists only approved public routes in the sitemap', () => {
        expect(sitemap().map(({ url }) => url)).toEqual(
            INDEXABLE_PUBLIC_ROUTES.map((path) => new URL(path, CANONICAL_ORIGIN).toString()),
        );
    });

    it('keeps authenticated, token-bearing, admin, and preview routes out of robots', () => {
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

    it('sends a noindex response header for every non-public route boundary', async () => {
        const headers = await nextConfig.headers?.();

        expect(headers).toEqual(
            NON_PUBLIC_INDEXING_BOUNDARIES.map(({ headerSource }) => ({
                headers: [NOINDEX_HEADER],
                source: headerSource,
            })),
        );
    });
});

describe('provisional legal entries', () => {
    it.each(Object.values(legalDocuments))('keeps $path visibly provisional', (document) => {
        const copy = document.sections.flatMap(({ body }) => body).join(' ');

        expect(copy).toContain('not the final');
        expect(copy).toMatch(/review/i);
        expect(copy).not.toMatch(/\b\d+\s*(day|week|month|year)s?\b/i);
        expect(copy).not.toMatch(/cookie/i);
    });
});
