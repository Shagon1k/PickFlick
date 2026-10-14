import type { MetadataRoute } from 'next';

import { CANONICAL_ORIGIN, INDEXABLE_PUBLIC_ROUTES } from '@/lib/indexing';

const SECONDARY_PAGE_PRIORITY = 0.7;

export default function sitemap(): MetadataRoute.Sitemap {
    return INDEXABLE_PUBLIC_ROUTES.map((path) => ({
        changeFrequency: path.startsWith('/legal/') ? 'yearly' : 'monthly',
        priority: path === '/' ? 1 : SECONDARY_PAGE_PRIORITY,
        url: new URL(path, CANONICAL_ORIGIN).toString(),
    }));
}
