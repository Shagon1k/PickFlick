export interface IAchievementDefinition {
    scope: 'CLUB' | 'PERSONAL';
    key: string;
    version: number;
    title: string;
    description: string;
    explanation: string;
    target: number;
    private?: boolean;
}

type TDefinitionData = Omit<IAchievementDefinition, 'scope'>;

const CLUB_ACHIEVEMENTS = [
    {
        key: 'first-screening',
        version: 1,
        title: 'First Screening',
        description: 'Complete the first Club Session.',
        explanation: 'Completed screenings; repeat viewings and PAST imports count.',
        target: 1,
    },
    {
        key: 'full-house',
        version: 1,
        title: 'Full House',
        description:
            'Every member at the screening date has recorded attendance in a Completed Session.',
        explanation:
            'Only explicit recorded attendance counts. Membership is reconstructed at the scheduled date; missing dates cannot qualify.',
        target: 1,
    },
    {
        key: 'critics-circle',
        version: 1,
        title: 'Critics Circle',
        description: 'Every member at the screening date has a recorded Session Rating.',
        explanation:
            'Recorded ratings for every member at the scheduled date. Missing dates or ratings cannot qualify.',
        target: 1,
        private: true,
    },
    {
        key: 'cult-classic',
        version: 1,
        title: 'Cult Classic',
        description: 'A Completed Session has an average historical rating of at least 9.',
        explanation:
            'At least one received historical rating; missing ratings are unknown, not zero.',
        target: 1,
        private: true,
    },
    {
        key: 'perfect-split',
        version: 1,
        title: 'Perfect Split',
        description: 'A live Selection ends with a one-point total-score margin.',
        explanation:
            'One point between the first two frozen live Selection totals; imported matrices do not establish an outcome.',
        target: 1,
        private: true,
    },
    {
        key: 'double-feature',
        version: 1,
        title: 'Double Feature',
        description: 'Complete two screenings scheduled in one UTC evening (18:00 onwards).',
        explanation:
            'Largest screening count on one scheduled UTC evening. Date-only screenings cannot qualify.',
        target: 2,
    },
    {
        key: 'decade-tour',
        version: 1,
        title: 'Decade Tour',
        description: 'Complete screenings of films from five release decades.',
        explanation:
            'Distinct known release decades from cached films; missing years add no evidence.',
        target: 5,
    },
    {
        key: 'marathon-night',
        version: 1,
        title: 'Marathon Night',
        description: 'Complete 240 minutes of cached film runtime in one UTC evening.',
        explanation:
            'Largest known runtime sum on one scheduled UTC evening, in minutes. Missing runtime adds no evidence.',
        target: 240,
    },
    {
        key: 'world-tour',
        version: 1,
        title: 'World Tour',
        description: 'Watch films from five production countries.',
        explanation:
            'Distinct production-country ISO codes from Completed screenings in the configured catalog cache; missing countries add no evidence.',
        target: 5,
    },
    {
        key: 'first-ten',
        version: 1,
        title: 'The First Ten',
        description: 'Complete ten Club Sessions, including recorded past screenings.',
        explanation: 'Completed screenings; repeat viewings and PAST imports count.',
        target: 10,
    },
    {
        key: 'packed-calendar',
        version: 1,
        title: 'Packed Calendar',
        description: 'Complete four screenings scheduled in one UTC calendar month.',
        explanation: 'Largest count in a scheduled UTC month; undated screenings add no evidence.',
        target: 4,
    },
    {
        key: 'shared-taste',
        version: 1,
        title: 'Shared Taste',
        description:
            'Three consecutive Completed screenings have historical averages of at least 8.',
        explanation:
            'Longest run in scheduled-date order, then Session ID. Missing averages or dates break the run.',
        target: 3,
        private: true,
    },
    {
        key: 'genre-roulette',
        version: 1,
        title: 'Genre Roulette',
        description: 'Complete screenings spanning seven cached genres.',
        explanation:
            'Distinct exact genre names in the configured catalog cache; missing genres add no evidence.',
        target: 7,
    },
    {
        key: 'silent-era',
        version: 1,
        title: 'Silent Era',
        description: 'Watch a film released before 1930.',
        explanation:
            'At least one Completed screening has a known film release year before 1930; missing years add no evidence.',
        target: 1,
    },
    {
        key: 'comeback',
        version: 1,
        title: 'The Comeback',
        description: 'Complete a screening scheduled at least 30 days after the previous one.',
        explanation: 'A gap of at least 30 days between consecutive known scheduled screenings.',
        target: 1,
    },
] as const satisfies TDefinitionData[];

const PERSONAL_ACHIEVEMENTS = [
    {
        key: 'opening-credits',
        version: 1,
        title: 'Opening Credits',
        description: 'Have a display name and profile image.',
        explanation:
            'Current display name and profile image; no image URL is retained in evidence.',
        target: 1,
    },
    {
        key: 'first-vote',
        version: 1,
        title: 'First Vote',
        description: 'Submit a live Selection ballot.',
        explanation:
            'Submitted live Selection ballots; partial imported scores do not count as ballots.',
        target: 1,
    },
    {
        key: 'reliable-viewer',
        version: 1,
        title: 'Reliable Viewer',
        description:
            'Have recorded attendance in five consecutive Completed screenings in one Club during membership.',
        explanation:
            'Longest run of explicitly recorded attendance in Completed screenings during one Club membership. Unknown attendance breaks the run.',
        target: 5,
    },
    {
        key: 'critic',
        version: 1,
        title: 'The Critic',
        description: 'Record ten historical Session Ratings after watching.',
        explanation:
            'Recorded historical Session Ratings. Personal Rating edits do not add historical ratings.',
        target: 10,
    },
    {
        key: 'panda-patron',
        version: 1,
        title: 'Panda Patron',
        description: 'A new member accepts your Club invitation.',
        explanation:
            'Accepted Club invitations created by you; pending or declined invitations do not count.',
        target: 1,
    },
    {
        key: 'nominator',
        version: 1,
        title: 'The Nominator',
        description: 'Nominate five films, including attributed past nominations.',
        explanation: 'Live nominations and PAST nominations explicitly attributed to you.',
        target: 5,
    },
    {
        key: 'never-miss',
        version: 1,
        title: 'Never Miss a Screening',
        description:
            'Have recorded attendance in ten consecutive Completed screenings in one Club during membership.',
        explanation: 'Same explicit-attendance and membership-window rule as Reliable Viewer.',
        target: 10,
    },
    {
        key: 'taste-maker',
        version: 1,
        title: 'Taste Maker',
        description: 'Your nomination wins three live Selections.',
        explanation:
            'Your nomination ID matches the frozen live winner. PAST chosen films do not prove a Selection win.',
        target: 3,
    },
    {
        key: 'genre-scout',
        version: 1,
        title: 'Genre Scout',
        description: 'Nominate films spanning five cached genres.',
        explanation:
            'Distinct known genres from your nominated films in the configured catalog cache.',
        target: 5,
    },
    {
        key: 'archivist',
        version: 1,
        title: 'Archivist',
        description: 'Save ten distinct films in Ratings or Watchlist.',
        explanation: 'Distinct films currently saved in Ratings or Watchlist; overlap counts once.',
        target: 10,
    },
    {
        key: 'long-review',
        version: 1,
        title: 'Long Review',
        description: 'Submit a Session Rating comment longer than 300 characters.',
        explanation:
            'Longest recorded Session Rating comment in JavaScript characters; comment text is not retained in achievement evidence.',
        target: 301,
    },
    {
        key: 'night-owl',
        version: 1,
        title: 'Night Owl',
        description: 'Have recorded attendance in a Completed screening scheduled after 23:00 UTC.',
        explanation:
            'Recorded attendance at a Completed screening scheduled strictly after 23:00 UTC. Date-only entries cannot qualify.',
        target: 1,
    },
    {
        key: 'early-bird',
        version: 1,
        title: 'Early Bird',
        description: 'Submit a live ballot within three hours of Selection opening.',
        explanation:
            'Ballot submitted from Selection opening through three hours later. Missing live opening timestamps cannot qualify.',
        target: 1,
    },
    {
        key: 'hot-take',
        version: 1,
        title: 'Hot Take',
        description:
            'Your historical Session Rating differs from its visible Completed Session average by at least 2.',
        explanation:
            'Absolute difference of at least two from the received historical average, including your own rating. Only currently accessible, visible Completed results qualify.',
        target: 1,
    },
] as const satisfies TDefinitionData[];

/** Every rule must report a metric under its exact key; the compiler checks both rule files. */
export type TClubAchievementKey = (typeof CLUB_ACHIEVEMENTS)[number]['key'];
export type TPersonalAchievementKey = (typeof PERSONAL_ACHIEVEMENTS)[number]['key'];

export const ACHIEVEMENT_DEFINITIONS: IAchievementDefinition[] = [
    ...CLUB_ACHIEVEMENTS.map((definition) => ({ ...definition, scope: 'CLUB' as const })),
    ...PERSONAL_ACHIEVEMENTS.map((definition) => ({ ...definition, scope: 'PERSONAL' as const })),
];
