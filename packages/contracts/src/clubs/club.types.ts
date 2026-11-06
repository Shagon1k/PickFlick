import type { TSessionPhase } from '../sessions/session.schema.js';
export type TClubRole = 'ADMIN' | 'MODERATOR' | 'MEMBER';
export type TClubLifecycle = 'ACTIVE' | 'ARCHIVED';
export type TClubTier = 'FREE' | 'PRO';

export const CLUB_PERMISSIONS = [
    'viewClub',
    'participate',
    'leaveClub',
    'manageSessions',
    'createInvitations',
    'manageMembers',
    'manageRoles',
    'manageSettings',
    'manageLifecycle',
] as const;

export type TClubPermission = (typeof CLUB_PERMISSIONS)[number];
export type TClubPermissions = Record<TClubPermission, boolean>;

export interface IClubEntitlements {
    tier: TClubTier;
    adminClubLimit: number;
    memberLimit: number;
}

/** Plan limits the API enforces and the public pricing pages describe. */
export const CLUB_TIER_ENTITLEMENTS: Record<TClubTier, IClubEntitlements> = {
    FREE: { tier: 'FREE', adminClubLimit: 1, memberLimit: 8 },
    PRO: {
        tier: 'PRO',
        adminClubLimit: 5,
        memberLimit: 16,
    },
};

export interface IClubSummary {
    id: string;
    name: string;
    createdAt: string;
    description?: string;
    hasAvatar: boolean;
    avatarVersion?: string;
    lifecycle: TClubLifecycle;
    membershipRole: TClubRole;
    selectionScaleMin: 0 | 1;
    selectionScaleMax: number;
    tier: TClubTier;
}

export interface IClubVisibility {
    showNominationAuthorsDuring: boolean;
    showNominationAuthorsAfter: boolean;
    showSelectionScoresDuring: boolean;
    showSelectionScoresAfter: boolean;
    showRatingsDuring: boolean;
    showRatingsAfter: boolean;
    showNominationsBeforeSubmit: boolean;
}

export interface IClubMember {
    id: string;
    displayName: string;
    avatarUrl: string | null;
    role: TClubRole;
    joinedAt: string;
    sessionCount: number;
    /** Whether the viewer may remove this member; the server enforces the same rule. */
    canRemove: boolean;
}

/** Everything the Manage Club page renders for the signed-in member. */
export interface IClubAccess {
    adminless: boolean;
    newWorkAllowed: boolean;
    /** Every member place is taken, so no invitation can be created. */
    isAtCapacity: boolean;
    reasons: ('ARCHIVED' | 'ADMINLESS' | 'MEMBER_LIMIT')[];
}

export interface IClubSettings {
    access: IClubAccess;
    currentMembershipId: string;
    club: IClubSummary;
    permissions: TClubPermissions;
    /** An Admin may delete the Club only while it has no Sessions. */
    canDelete: boolean;
    entitlements: IClubEntitlements;
    visibility: IClubVisibility;
    members: IClubMember[];
}

export interface IClubHubMovie {
    id: string;
    title: string | null;
    year: number | null;
    runtime: number | null;
    genres: string[];
    posterUrl: string | null;
}

export interface IClubHubParticipant {
    id: string;
    displayName: string;
    avatarUrl: string | null;
}

export interface IClubHubSession {
    id: string;
    ordinal: number;
    acceptedCount: number;
    nominatedCount: number;
    progressCount: number | null;
    ratingAverage: number | null;
    canJoin: boolean;
    movie: IClubHubMovie | null;
    phase: TSessionPhase;
    topic?: string;
    scheduledAt?: string;
    location?: string;
    updatedAt: string;
    /** Accepted participants, present only while Rating is open. */
    participants?: IClubHubParticipant[];
}

export interface IClubSessionHistoryPage {
    sessions: IClubHubSession[];
    nextCursor: string | null;
}

/** One authorized snapshot for every contextual section of the Club Hub. */
export interface IClubHub {
    access: IClubAccess;
    permissions: TClubPermissions;
    club: IClubSummary;
    memberCount: number;
    sessionCount: number;
    memberLimit: number;
    members: IClubMember[];
    statistics: {
        sessionsWatched: number | null;
        sessionsThisYear: number | null;
        averageRating: number | null;
        totalWatchHours: number | null;
        topGenre: string | null;
        topDirector: string | null;
        topActor: string | null;
    };
    activeSession?: IClubHubSession;
    recentSessions: IClubHubSession[];
    ratingSessions: IClubHubSession[];
    historySessions: IClubHubSession[];
    historyNextCursor: string | null;
}

/** Why a Club request conflicted with current state; the web maps each to recovery copy. */
export const CLUB_CONFLICT_REASONS = [
    'CONFIRMATION_MISMATCH',
    'ADMIN_CLUB_LIMIT_REACHED',
    'ADMIN_MUST_TRANSFER',
    'SESSION_HISTORY',
    'CLUB_ARCHIVED',
    'MEMBERSHIP_INELIGIBLE',
] as const;

export type TClubConflictReason = (typeof CLUB_CONFLICT_REASONS)[number];

/** The Club Hub and each history page list this many closed Sessions. */
export const HUB_HISTORY_LIMIT = 10;
