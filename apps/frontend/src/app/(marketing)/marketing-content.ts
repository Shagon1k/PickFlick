import { CLUB_TIER_ENTITLEMENTS } from '@pickflick/contracts';

export const landingSteps = [
    {
        title: 'Nominate',
        description:
            "Each friend picks one film from TMDB's catalog or brings back a past pick that did not win. Every participant gets one nomination.",
    },
    {
        title: 'Select',
        description:
            "Score every nomination on the Club's chosen scale. Live progress keeps the crew in sync, and deterministic tie-breakers settle the result.",
    },
    {
        title: 'Watch',
        description:
            "Keep the screening date, location, notes, and winning film together. Every completed Session adds another chapter to the Club's history.",
    },
    {
        title: 'Rate',
        description:
            "Rate the film from 1 to 10 after the screening. Session Ratings preserve the night's verdict while personal ratings remain yours to edit.",
    },
] as const;

export const landingFeatures = [
    {
        icon: 'catalog',
        title: 'TMDB-powered search',
        description:
            'Find films with posters, genres, synopses, and release details before adding a nomination.',
    },
    {
        icon: 'pulse',
        title: 'Deterministic tie-breakers',
        description:
            'A fixed sequence resolves tied scores consistently, so the Club can move from Selection to Watching.',
    },
    {
        icon: 'clock',
        title: 'Bring back your past picks',
        description:
            'Your past nominations in the current Club that did not win appear as suggestions for a future Session.',
    },
    {
        icon: 'clubs',
        title: 'Multiple Clubs',
        description:
            'Keep friends, family, and coworkers in separate Clubs, each with its own Sessions and history.',
    },
    {
        icon: 'chart',
        title: 'Club history and ratings',
        description:
            'Remember every screening and see the ratings that reflect what your Club actually watched together.',
    },
    {
        icon: 'device',
        title: 'Install on any device',
        description:
            'Add PickFlick to your home screen without an app store. A connection is required for nominations, selections, and other changes.',
    },
] as const;

const { FREE, PRO } = CLUB_TIER_ENTITLEMENTS;

/** `limited` marks a Free-plan restriction; `upgrade` marks what Pro adds over Free. */
export interface IPlanFeature {
    readonly label: string;
    readonly tone?: 'limited' | 'upgrade';
}

export const freePlanFeatures: readonly IPlanFeature[] = [
    { label: `${FREE.adminClubLimit} administered Club` },
    { label: `Up to ${FREE.memberLimit} members per Club` },
    { label: '1 blocking Session per Club' },
    { label: 'Unlimited open Rating Sessions' },
    { label: 'Unlimited Session history' },
    { label: 'Club customization' },
    { label: 'Basic counters and the Club ratings leaderboard' },
    { label: 'Vote results hidden from ordinary members', tone: 'limited' },
    { label: '90-day inactivity grace', tone: 'limited' },
];

export const proPlanFeatures: readonly IPlanFeature[] = [
    { label: `${PRO.adminClubLimit} administered Clubs`, tone: 'upgrade' },
    { label: `Up to ${PRO.memberLimit} members per Club`, tone: 'upgrade' },
    { label: '1 blocking Session per Club' },
    { label: 'Unlimited open Rating Sessions' },
    { label: 'Unlimited Session history' },
    { label: 'Club customization' },
    { label: 'Admin-configurable vote results', tone: 'upgrade' },
    { label: '180-day inactivity grace', tone: 'upgrade' },
    { label: 'Extended deterministic analytics' },
];

export const comparisonRows = [
    {
        feature: 'Administered Clubs',
        free: String(FREE.adminClubLimit),
        pro: String(PRO.adminClubLimit),
    },
    { feature: 'Clubs joined as Member or Moderator', free: 'Unlimited', pro: 'Unlimited' },
    {
        feature: 'Members per Club',
        free: `Up to ${FREE.memberLimit}`,
        pro: `Up to ${PRO.memberLimit}`,
    },
    { feature: 'Blocking Sessions per Club', free: '1', pro: '1' },
    { feature: 'Open Rating Sessions per Club', free: 'Unlimited', pro: 'Unlimited' },
    { feature: 'Session history', free: 'Unlimited', pro: 'Unlimited' },
    { feature: 'Club customization', free: 'Included', pro: 'Included' },
    { feature: 'Vote-result visibility', free: 'Always hidden', pro: 'Admin-configurable' },
    { feature: 'Inactivity grace', free: '90 days', pro: '180 days' },
    { feature: 'Club ratings leaderboard', free: 'Included', pro: 'Included' },
    { feature: 'Analytics', free: 'Basic counters', pro: 'Extended deterministic' },
    { feature: 'Price', free: '€0', pro: '€5 / month' },
] as const;

export const pricingFaqs = [
    {
        question: 'Can I switch plans anytime?',
        answer: 'Once billing launches, you can upgrade to Pro at any time. Cancellation or downgrade takes effect at the end of the paid monthly billing period. Data stays in place, while over-limit Clubs become read-only for new rounds and invitations until they are within Free limits.',
    },
    {
        question: 'What happens when I downgrade?',
        answer: 'Pro features remain active until the paid billing period ends. After that, over-limit Clubs keep their history but cannot start new rounds or send invitations until the account is within Free limits.',
    },
    {
        question: 'How many Clubs can I join?',
        answer: 'As many as you like as a Member or Moderator. The plan limit applies only to Clubs you administer: one on Free and five on Pro.',
    },
    {
        question: 'Do my Club members need Pro too?',
        answer: "No. Members join for free. The Club Admin's plan determines that Club's member limit, inactivity grace period, and vote-result visibility.",
    },
    {
        question: 'What is the inactivity grace period?',
        answer: 'A Club with no activity for 90 days on Free or 180 days on Pro can be archived after the Admin is notified. Nothing is automatically deleted, and the Club can be reactivated.',
    },
    {
        question: 'Can I upgrade to Pro now?',
        answer: 'Not yet. Pro checkout is coming soon. Until then, you can start on Free without entering payment details.',
    },
] as const;
