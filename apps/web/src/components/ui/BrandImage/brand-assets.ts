import favicon from '@brand/favicon.png';
import panda404 from '@brand/panda-404.webp';
import pandaAnalytic from '@brand/panda-analytic.webp';
import pandaBasic from '@brand/panda-basic.webp';
import pandaChill from '@brand/panda-chill.webp';
import pandaChoosing from '@brand/panda-choosing.webp';
import pandaCoffeeCollection from '@brand/panda-coffee-collection.webp';
import pandaCollection from '@brand/panda-collection.webp';
import pandaCritic from '@brand/panda-critic.webp';
import pandaHero from '@brand/panda-hero.webp';
import pandaInvited from '@brand/panda-invited.webp';
import pandaInvitedCampaign from '@brand/panda-invited-2.webp';
import pandaLogo from '@brand/panda-logo.webp';
import pandaPollMaster from '@brand/panda-poll-master.webp';
import pandaPrivacy from '@brand/panda-privacy.webp';
import pandaProjectionist from '@brand/panda-projectionist.webp';
import pandaRating from '@brand/panda-rating.webp';
import pandaRatingResults from '@brand/panda-rating-2.webp';
import pandaScales from '@brand/panda-scales.webp';
import pandaSession from '@brand/panda-session.webp';
import pandaSettingsProfile from '@brand/panda-settings-1.webp';
import pandaSettingsSubscription from '@brand/panda-settings-2.webp';
import pandaWatching from '@brand/panda-watching.webp';
import pandaZoom from '@brand/panda-zoom.webp';
import type { StaticImageData } from 'next/image';

interface IBrandAsset {
    source: StaticImageData;
    width: number;
    height: number;
    role: string;
    /** Assets with baked-in English text may only appear where that limitation is acceptable. */
    containsEmbeddedText: boolean;
}

export const BRAND_ASSETS = {
    favicon: {
        source: favicon,
        width: 300,
        height: 300,
        role: 'favicon-pwa-source',
        containsEmbeddedText: false,
    },
    logo: {
        source: pandaLogo,
        width: 350,
        height: 350,
        role: 'brand-mark',
        containsEmbeddedText: false,
    },
    hero: {
        source: pandaHero,
        width: 750,
        height: 400,
        role: 'landing-hero',
        containsEmbeddedText: false,
    },
    errorRecovery: {
        source: panda404,
        width: 604,
        height: 381,
        role: 'error-recovery',
        containsEmbeddedText: false,
    },
    analytics: {
        source: pandaAnalytic,
        width: 308,
        height: 358,
        role: 'analytics',
        containsEmbeddedText: false,
    },
    freePlan: {
        source: pandaBasic,
        width: 340,
        height: 392,
        role: 'free-plan',
        containsEmbeddedText: false,
    },
    proPlan: {
        source: pandaProjectionist,
        width: 281,
        height: 361,
        role: 'pro-plan',
        containsEmbeddedText: false,
    },
    calmEmptyWaiting: {
        source: pandaChill,
        width: 434,
        height: 351,
        role: 'calm-empty-waiting',
        containsEmbeddedText: false,
    },
    selection: {
        source: pandaChoosing,
        width: 435,
        height: 300,
        role: 'selection',
        containsEmbeddedText: false,
    },
    tieBreakBalance: {
        source: pandaScales,
        width: 400,
        height: 360,
        role: 'tie-break-balance',
        containsEmbeddedText: false,
    },
    pollSelectionAchievement: {
        source: pandaPollMaster,
        width: 355,
        height: 360,
        role: 'poll-selection-achievement',
        containsEmbeddedText: false,
    },
    watchingMembers: {
        source: pandaWatching,
        width: 348,
        height: 240,
        role: 'watching-members',
        containsEmbeddedText: false,
    },
    sessionManagement: {
        source: pandaSession,
        width: 460,
        height: 350,
        role: 'session-management',
        containsEmbeddedText: false,
    },
    ratingPrompt: {
        source: pandaRating,
        width: 435,
        height: 250,
        role: 'rating-prompt',
        containsEmbeddedText: false,
    },
    ratingResults: {
        source: pandaRatingResults,
        width: 470,
        height: 315,
        role: 'rating-results-alternate',
        containsEmbeddedText: false,
    },
    reviewsCritique: {
        source: pandaCritic,
        width: 305,
        height: 375,
        role: 'reviews-critique',
        containsEmbeddedText: false,
    },
    libraryCollection: {
        source: pandaCollection,
        width: 440,
        height: 300,
        role: 'library-collection',
        containsEmbeddedText: false,
    },
    libraryAchievements: {
        source: pandaCoffeeCollection,
        width: 455,
        height: 305,
        role: 'library-achievements-alternate',
        containsEmbeddedText: false,
    },
    privacyData: {
        source: pandaPrivacy,
        width: 270,
        height: 270,
        role: 'privacy-data',
        containsEmbeddedText: false,
    },
    settingsProfile: {
        source: pandaSettingsProfile,
        width: 400,
        height: 400,
        role: 'settings-profile',
        containsEmbeddedText: false,
    },
    settingsSubscription: {
        source: pandaSettingsSubscription,
        width: 450,
        height: 325,
        role: 'settings-subscription-alternate',
        containsEmbeddedText: false,
    },
    invitation: {
        source: pandaInvited,
        width: 400,
        height: 300,
        role: 'invitation',
        containsEmbeddedText: false,
    },
    invitationCampaign: {
        source: pandaInvitedCampaign,
        width: 400,
        height: 290,
        role: 'invitation-campaign-alternate',
        containsEmbeddedText: true,
    },
    searchDiscovery: {
        source: pandaZoom,
        width: 464,
        height: 385,
        role: 'search-discovery',
        containsEmbeddedText: false,
    },
} as const satisfies Record<string, IBrandAsset>;

export type TBrandAssetKey = keyof typeof BRAND_ASSETS;
