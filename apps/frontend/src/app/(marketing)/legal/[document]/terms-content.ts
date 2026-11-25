export const termsSections = [
    {
        title: 'Draft status and operator',
        body: [
            'These are preview terms for review, not the final approved Terms of Service. Operator: {TODO_OPERATOR_NAME_HERE}, Lithuania. Address: {TODO_OPERATOR_ADDRESS_HERE}. Registration: {TODO_REGISTRATION_DETAILS_HERE}. Contact: hello@pick-flick.app.',
            'The operating form, registration, final contract terms and Europe/US legal review remain outstanding. This draft has no approved effective date and does not waive mandatory consumer or privacy rights.',
        ],
    },
    {
        title: 'Accounts and eligibility',
        body: [
            'PickFlick coordinates private Club movie nights, film selection and shared viewing history. Product features require a registered account. Google sign-in is available; Apple sign-in is gated off. Keep control of your sign-in account and contact us if access is compromised.',
            'The intended minimum product age is 16, with Europe and the US as intended markets. Country-specific eligibility requirements, age safeguards and the response to discovered underage accounts still need review before launch.',
        ],
    },
    {
        title: 'Clubs, Sessions and contributions',
        body: [
            'Club roles are Admin, Moderator and Member. Club settings and current membership govern access to nominations, Selection responses, Session Ratings and comments. App Admin is a separate application role and does not grant Club access.',
            'Personal Ratings are editable and separate from historical Session Ratings. Shared history may contain contributions and attendance recorded by other members. Use care when entering names, locations or other personal information in shared text.',
            'The proposed acceptable-use terms require permission to share content and prohibit harassment, unlawful material, exposing others’ private information and attempts to bypass access controls. The final content license, moderation and enforcement procedure remain subject to legal review; this draft does not grant a new content license.',
        ],
    },
    {
        title: 'Your data and account removal',
        body: [
            'The Privacy Notice describes data handling, current export tools and retention limits. Settings provides Personal Ratings CSV preview/import/export and a private personal archive with a manifest and exclusions. Archive availability ends seven days after generation, even if downloaded earlier.',
            'Account deletion requires same-account sign-in again and a separate DELETE confirmation. Access ends immediately. Private files are cleaned up asynchronously, with a 24-hour operational target rather than an outage-proof guarantee.',
            'Shared Clubs, Sessions, nominations, ballots, ratings and comment text remain under “Deleted user”. Administered Clubs become adminless. Technical references and some operational records remain; backups, provider copies and personal details in free text require separate handling as described in the Privacy Notice. Contact hello@pick-flick.app for a request concerning that text.',
        ],
    },
    {
        title: 'Plans and payments',
        body: [
            'Free features are available without payment details. Where sandbox billing is configured, Pro checkout and subscription management use Link and the hosted billing portal. The monthly offer is €5 plus applicable tax at checkout, billed from the first successful payment. Period-end cancellation is managed in the portal. Live paid-service activation and these draft terms still require review.',
            'Payment-provider selection, renewal, cancellation, refunds, financial retention and commercial terms must be approved before paid service is enabled. No paid-service cancellation or refund guarantee is established by this draft.',
        ],
    },
    {
        title: 'External services and availability',
        body: [
            'Film metadata comes from configured external catalogs. Trailers connect to YouTube after you press Play; external film links open their own services. Those services have their own terms and privacy information. PickFlick does not provide film streaming rights through its catalog.',
            'The preview may be unavailable or change during development. Final service-change, suspension, termination, liability, governing-law and dispute provisions remain under legal review. No blanket liability exclusion, arbitration requirement or restriction of statutory rights is introduced here.',
        ],
    },
    {
        title: 'Before public launch',
        body: [
            'The owner and legal/privacy reviewer must approve the exact public terms and Privacy Notice, replace operator placeholders and resolve applicable Europe/US and Lithuanian operating requirements. Hosted UI review is a separate engineering acceptance checkpoint. Preparing this draft does not complete those approvals.',
        ],
    },
] as const;
