export const legalDocuments = {
    privacy: {
        description: 'Read the provisional PickFlick privacy entry before final legal review.',
        eyebrow: 'Provisional legal entry',
        path: '/legal/privacy',
        sections: [
            {
                body: [
                    'This page is a temporary entry point for the PickFlick preview. It is not the final, legally reviewed Privacy Notice.',
                    'The final notice must match the data behavior implemented for launch and explain it in full before PickFlick is released to the public.',
                ],
                title: 'Status of this notice',
            },
            {
                body: [
                    'Data handling, providers, exports, deletion, and retention remain subject to implementation review and legal or privacy approval. This draft does not set those policies.',
                ],
                title: 'What remains under review',
            },
        ],
        title: 'Privacy Notice',
    },
    terms: {
        description: 'Read the provisional PickFlick terms entry before final legal review.',
        eyebrow: 'Provisional legal entry',
        path: '/legal/terms',
        sections: [
            {
                body: [
                    'This page is a temporary entry point for the PickFlick preview. It is not the final, legally reviewed Terms of Service.',
                    'The final terms must match the service offered at launch and be approved before PickFlick is released to the public.',
                ],
                title: 'Status of these terms',
            },
            {
                body: [
                    'Account access, Club responsibilities, acceptable use, paid plans, suspension, and service changes remain subject to product implementation and legal review. This draft does not establish those terms.',
                ],
                title: 'What remains under review',
            },
        ],
        title: 'Terms of Service',
    },
} as const;

export type TLegalDocumentName = keyof typeof legalDocuments;

export function isLegalDocumentName(value: string): value is TLegalDocumentName {
    return value in legalDocuments;
}
