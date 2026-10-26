export interface IAchievementDefinition {
    scope: 'CLUB' | 'PERSONAL';
    key: string;
    version: number;
    title: string;
    description: string;
    target: number;
}

function define(
    scope: IAchievementDefinition['scope'],
    rows: [string, string, string, number][],
): IAchievementDefinition[] {
    return rows.map(([key, title, description, target]) => ({
        scope,
        key,
        title,
        description,
        target,
        version: 1,
    }));
}

export const ACHIEVEMENT_DEFINITIONS = [
    ...define('CLUB', [
        ['first-screening', 'First Screening', 'Complete the first Club Session.', 1],
        [
            'full-house',
            'Full House',
            'Every member at the screening date has recorded attendance in a Completed Session.',
            1,
        ],
        [
            'critics-circle',
            'Critics Circle',
            'Every member at the screening date has a recorded Session Rating.',
            1,
        ],
        [
            'cult-classic',
            'Cult Classic',
            'A Completed Session has an average historical rating of at least 9.',
            1,
        ],
        [
            'perfect-split',
            'Perfect Split',
            'A live Selection ends with a one-point total-score margin.',
            1,
        ],
        [
            'double-feature',
            'Double Feature',
            'Complete two screenings scheduled in one UTC evening (18:00 onwards).',
            2,
        ],
        [
            'decade-tour',
            'Decade Tour',
            'Complete screenings of films from five release decades.',
            5,
        ],
        [
            'marathon-night',
            'Marathon Night',
            'Complete 240 minutes of cached film runtime in one UTC evening.',
            240,
        ],
        ['world-tour', 'World Tour', 'Watch films from five production countries.', 5],
        [
            'first-ten',
            'The First Ten',
            'Complete ten Club Sessions, including recorded past screenings.',
            10,
        ],
        [
            'packed-calendar',
            'Packed Calendar',
            'Complete four screenings scheduled in one UTC calendar month.',
            4,
        ],
        [
            'shared-taste',
            'Shared Taste',
            'Three consecutive Completed screenings have historical averages of at least 8.',
            3,
        ],
        [
            'genre-roulette',
            'Genre Roulette',
            'Complete screenings spanning seven cached genres.',
            7,
        ],
        ['silent-era', 'Silent Era', 'Watch a black-and-white film.', 1],
        [
            'comeback',
            'The Comeback',
            'Complete a screening scheduled at least 30 days after the previous one.',
            1,
        ],
    ]),
    ...define('PERSONAL', [
        ['opening-credits', 'Opening Credits', 'Have a display name and profile image.', 1],
        ['first-vote', 'First Vote', 'Submit a live Selection ballot.', 1],
        [
            'reliable-viewer',
            'Reliable Viewer',
            'Have recorded attendance in five consecutive Completed screenings in one Club during membership.',
            5,
        ],
        ['critic', 'The Critic', 'Record ten historical Session Ratings after watching.', 10],
        ['panda-patron', 'Panda Patron', 'A new member accepts your Club invitation.', 1],
        [
            'nominator',
            'The Nominator',
            'Nominate five films, including attributed past nominations.',
            5,
        ],
        [
            'never-miss',
            'Never Miss a Screening',
            'Have recorded attendance in ten consecutive Completed screenings in one Club during membership.',
            10,
        ],
        ['taste-maker', 'Taste Maker', 'Your nomination wins three live Selections.', 3],
        ['genre-scout', 'Genre Scout', 'Nominate films spanning five cached genres.', 5],
        ['archivist', 'Archivist', 'Save ten distinct films in Ratings or Watchlist.', 10],
        [
            'long-review',
            'Long Review',
            'Submit a Session Rating comment longer than 300 characters.',
            301,
        ],
        [
            'night-owl',
            'Night Owl',
            'Have recorded attendance in a Completed screening scheduled after 23:00 UTC.',
            1,
        ],
        [
            'early-bird',
            'Early Bird',
            'Submit a live ballot within three hours of Selection opening.',
            1,
        ],
        [
            'hot-take',
            'Hot Take',
            'Your historical Session Rating differs from its visible Completed Session average by at least 2.',
            1,
        ],
    ]),
];

export const PRIVATE_CLUB_CRITERIA = new Set([
    'critics-circle',
    'cult-classic',
    'perfect-split',
    'shared-taste',
]);
