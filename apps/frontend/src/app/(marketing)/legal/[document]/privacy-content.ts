export const privacySections = [
    {
        title: 'Draft status and operator',
        body: [
            'This preview draft describes the current application and proposed launch policy. It is not an approved public Privacy Notice. Operator details, legal bases, provider arrangements and country-specific review for Europe and the US must be completed before public launch.',
            'Operator in Lithuania: {TODO_OPERATOR_NAME_HERE}. Address: {TODO_OPERATOR_ADDRESS_HERE}. Registration: {TODO_REGISTRATION_DETAILS_HERE}. Contact: hello@pick-flick.app. Business registration and the final operating form are not yet confirmed.',
        ],
    },
    {
        title: 'Data we store and where it comes from',
        body: [
            'Google sign-in supplies an account identifier, email, name and optional photo. Apple sign-in is implemented behind a gate and is not enabled. We store your profile, uploaded avatar, personal appearance settings, authentication sessions and notification preferences.',
            'Your activity creates Club memberships and invitations, Session participation, nominations, Selection ballots, Session Ratings and comments, Personal Ratings, Watchlist entries, achievements and notifications. Other Club members can record shared Session information and historical participation involving you.',
            'Session records can include locations and other text entered by members. Authentication records can include IP addresses and browser information. Support and privacy messages, security counters, delivery records, audit events, export and deletion jobs also contain information needed to operate the service.',
        ],
    },
    {
        title: 'Purposes and legal bases under review',
        body: [
            'We use account and activity data to sign you in, coordinate private Club screenings, preserve shared history, show ratings and achievements, deliver notifications, answer requests and protect accounts from abuse. Club members see shared content according to current membership and Club visibility settings; an Admin role does not bypass those visibility rules.',
            'The proposed launch bases are performance of the service contract for account and Club features, legitimate interests for security and service integrity, legal obligations where a specific law applies, and consent where required for an optional activity. The final purpose-to-basis mapping, legitimate-interest assessment and any consent requirements await legal/privacy review. This draft does not establish that those bases cover every current activity.',
        ],
    },
    {
        title: 'Providers and external connections',
        body: [
            'The current service uses hosting and deployment infrastructure, Cloudflare for edge traffic, PostgreSQL, Redis and private S3-compatible object storage. UAT uses MinIO; production storage and hosting details remain to be confirmed. Google handles enabled sign-in. Resend handles service email and Google Workspace handles correspondence.',
            'Configured catalog adapters query PoiskKino, TheTVDB or TMDB from the server, sending search text or film identifiers and server network information. Catalog images, Google profile photos and YouTube trailer thumbnails are fetched by PickFlick and served through its own origin; the browser does not contact those image providers directly.',
            'Pressing Play connects your browser to YouTube at youtube-nocookie.com. YouTube then receives network and device information and may use player storage. Following an external film link connects to that external service. A privacy-enhanced player is not a guarantee that consent is unnecessary.',
            'Paddle billing and Sentry monitoring are planned integrations, not enabled payment or monitoring services. No advertising or marketing tracker is integrated in the current application source. Provider legal entities, roles, regions, contracts, retention and any international-transfer safeguards still require review; EEA-only processing is not promised.',
        ],
    },
    {
        title: 'Cookies and browser storage',
        body: [
            'Sign-in uses a host-only session cookie named __Host-pickflick.session_token on HTTPS environments (pickflick.session_token locally). Sessions last seven days and can renew after one day of use. The pickflick.last_club session cookie remembers which Club to open. Sign-in may also use temporary authentication cookies.',
            'Personal appearance preferences are stored with your account. The current application source includes no analytics or advertising cookies. Deployed edge behavior, temporary sign-in storage and the YouTube player still need browser and legal review. This notice makes no blanket cookie-consent exemption claim.',
        ],
    },
    {
        title: 'Personal ratings and data archives',
        body: [
            'Settings → Import & Export accepts a version 1 PickFlick Personal Ratings CSV after preview and confirmation. It replaces changed Personal Ratings without changing historical Session Ratings. CSV export contains your current Personal Ratings; an empty Library produces a template.',
            'Settings → Privacy & data lets you request an asynchronous personal data archive, check its status and download it when ready. The gzip-compressed JSON contains your stored profile, own activity and a manifest explaining included fields and exclusions. It excludes credentials, other users’ profiles and private responses, shared Club/Session free text, provider/mailbox copies, application or edge logs and backups. It is not an export of every copy held by every provider.',
            'An archive is available for seven days after successful generation. Downloading does not extend that period. A download link lasts at most five minutes and still requires your active signed-in account. Expired files are queued for physical removal; storage failures can delay removal but cannot extend download access.',
        ],
    },
    {
        title: 'Account deletion and shared history',
        body: [
            'To delete an account, sign in again to the same account and separately type DELETE in Settings. Acceptance ends all sessions and account access immediately, removes profile identifiers and private Library/Watchlist data, and schedules private-file cleanup. The operational cleanup target is 24 hours after confirmation; outages can delay it and failed work is retried.',
            'Shared Clubs, Sessions, nominations, ballots, ratings and comments remain, with profile attribution replaced by “Deleted user”. Clubs you administer become adminless and remaining members are notified. Technical identifiers, shared-history references, audit and minimal deletion records remain. Removing profile attribution does not prove irreversible anonymization.',
            'Comment text and other shared free text are preserved and may still identify someone. Contact hello@pick-flick.app about personal details in that text. The proposed manual process is to verify the request and remove the relevant passage or, if needed, the particular comment while preserving the rating and Session. No automatic text scanning is performed.',
            'Already delivered email, provider-held copies and backups are outside account-file cleanup. Deletion does not claim to cancel a paid subscription: billing is not implemented.',
        ],
    },
    {
        title: 'Retention targets and current limits',
        body: [
            'Account data supports the service while the account is active, subject to requested deletion and the shared-history limits above. The seven-day archive availability is enforced. Broader retention automation is not yet implemented, so the following owner-selected launch targets are not current deletion guarantees.',
            'Targets: technical logs for 30 days from the event; administrative audit for 90 days from the event; support/privacy correspondence for 90 days after the request closes; completed export/deletion job metadata for 90 days, without archive contents. Shared-history references require separate handling and are not covered by a blanket metadata purge.',
            'The backup target is up to 30 days from snapshot creation, with deletions reapplied before restored data is used. Backup expiry and restore reapplication are not yet verified or enforced by the application. Provider-held copies need separate periods and agreements.',
            'The proposed inactivity policy archives Free Clubs and accounts after 180 days and Pro after 360 days, with reactivation rather than automatic erasure. Inactivity archiving is not implemented. It does not replace the right to request deletion.',
            'Proposed exceptions are limited to necessary data for a specific legal obligation, dispute or investigated incident, with the reason recorded and the data removed when that basis ends. Financial periods will be reviewed before billing is enabled. These exceptions and the remaining purpose-specific schedules still need legal/privacy approval.',
        ],
    },
    {
        title: 'Requests, rights and complaints',
        body: [
            'Write to hello@pick-flick.app to request access, correction, erasure, restriction, portability or to object to processing. Where processing relies on consent, you can withdraw it. Rights depend on the applicable law and processing basis; the Settings tools do not replace a rights request. We may need proportionate information to verify your identity.',
            'For GDPR requests, the response period is normally one month; where the law permits an extension, you must be informed within that month. You may complain to your local data protection authority, including Lithuania’s State Data Protection Inspectorate (vdai.lrv.lt). The request-handling workflow and Europe/US-specific disclosures must be reviewed and tested before launch.',
        ],
    },
    {
        title: 'Age and changes before launch',
        body: [
            'The intended minimum product age is 16, for users in Europe and the US. Age-related safeguards and country-specific requirements remain under review; a stated minimum age does not establish verified age checks.',
            'Real operator details, a named legal/privacy reviewer, exact-copy approval, provider/cookie evidence, retention and restore evidence, and a tested manual request process remain public-launch checkpoints. This preview draft has no approved policy effective date.',
        ],
    },
] as const;
