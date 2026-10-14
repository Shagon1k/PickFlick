import type { Metadata } from 'next';

import { CANONICAL_ORIGIN } from '#lib/indexing';

const SOCIAL_IMAGE = {
    alt: 'PickFlick — choose a film together',
    height: 630,
    url: '/opengraph-image',
    width: 1200,
} as const;

interface IPublicMetadataInput {
    readonly description: string;
    readonly path: `/${string}`;
    readonly title: string;
}

export function createPublicMetadata({ description, path, title }: IPublicMetadataInput): Metadata {
    return {
        alternates: { canonical: path },
        description,
        openGraph: {
            description,
            images: [SOCIAL_IMAGE],
            siteName: 'PickFlick',
            title,
            type: 'website',
            url: path,
        },
        robots: { follow: true, index: true },
        title,
        twitter: {
            card: 'summary_large_image',
            description,
            images: [SOCIAL_IMAGE],
            title,
        },
    };
}

export const rootMetadata: Metadata = {
    description: 'Pick a film together.',
    metadataBase: new URL(CANONICAL_ORIGIN),
    robots: {
        follow: false,
        index: false,
        noarchive: true,
    },
    title: 'PickFlick',
};
