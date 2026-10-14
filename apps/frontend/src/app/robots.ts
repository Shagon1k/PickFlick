import type { MetadataRoute } from 'next';

import { CANONICAL_ORIGIN, NON_PUBLIC_INDEXING_BOUNDARIES } from '#lib/indexing';

export default function robots(): MetadataRoute.Robots {
    return {
        host: CANONICAL_ORIGIN,
        rules: {
            allow: '/',
            disallow: NON_PUBLIC_INDEXING_BOUNDARIES.map(({ robotsPath }) => robotsPath),
            userAgent: '*',
        },
        sitemap: `${CANONICAL_ORIGIN}/sitemap.xml`,
    };
}
