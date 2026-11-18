import { privacySections } from './privacy-content';
import { termsSections } from './terms-content';

export const legalDocuments = {
    privacy: {
        description: 'Read the provisional PickFlick privacy entry before final legal review.',
        eyebrow: 'Preview policy draft',
        path: '/legal/privacy',
        sections: privacySections,
        title: 'Privacy Notice',
    },
    terms: {
        description: 'Read the provisional PickFlick terms entry before final legal review.',
        eyebrow: 'Preview policy draft',
        path: '/legal/terms',
        sections: termsSections,
        title: 'Terms of Service',
    },
} as const;

export type TLegalDocumentName = keyof typeof legalDocuments;

export function isLegalDocumentName(value: string): value is TLegalDocumentName {
    // `in` would also accept inherited names such as `constructor`.
    return Object.hasOwn(legalDocuments, value);
}
