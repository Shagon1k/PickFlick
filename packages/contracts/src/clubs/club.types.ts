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
    'viewAudit',
] as const;

export type TClubPermission = (typeof CLUB_PERMISSIONS)[number];
export type TClubPermissions = Record<TClubPermission, boolean>;

export interface IClubEntitlements {
    tier: TClubTier;
    adminClubLimit: number;
    memberLimit: number;
    voteResultVisibility: 'ADMIN_HIDDEN' | 'ADMIN_CONFIGURABLE';
}

export interface IClubSummary {
    id: string;
    name: string;
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
    showNominationAuthors: boolean;
    showNominationsBeforeSubmit: boolean;
    showVoteResults: boolean;
    showRatingResults: boolean;
    useMonochromeMedia: boolean;
}

export interface IClubMember {
    id: string;
    displayName: string;
    role: TClubRole;
    joinedAt: string;
    /** Whether the viewer may remove this member; the server enforces the same rule. */
    canRemove: boolean;
}

export const CLUB_AUDIT_ACTIONS = [
    'SESSION_CREATED',
    'SESSION_UPDATED',
    'SESSION_CANCELLED',
    'SESSION_NOMINATION_CLOSED',
    'SESSION_INVITE_CREATED',
    'SESSION_INVITE_REVOKED',
    'SESSION_INVITE_RESPONDED',
    'SESSION_PARTICIPANT_LEFT',
    'SESSION_PARTICIPANT_REMOVED',
    'MEMBERSHIP_ROLE_CHANGED',
    'ADMIN_TRANSFERRED',
    'CLUB_SETTINGS_UPDATED',
    'CLUB_AVATAR_UPDATED',
    'CLUB_ARCHIVED',
    'CLUB_REACTIVATED',
    'MEMBERSHIP_LEFT',
    'MEMBERSHIP_REMOVED',
    'CLUB_DELETED',
    'CLUB_INVITE_CREATED',
    'CLUB_INVITE_REVOKED',
    'MEMBERSHIP_JOINED',
] as const;

export type TClubAuditAction = (typeof CLUB_AUDIT_ACTIONS)[number];

export interface IClubAuditEvent {
    id: string;
    action: TClubAuditAction;
    createdAt: string;
}

/** Everything the Manage Club page renders for the signed-in member. */
export interface IClubAccess {
    adminless: boolean;
    newWorkAllowed: boolean;
    reasons: ('ARCHIVED' | 'ADMINLESS' | 'MEMBER_LIMIT')[];
}

export interface IClubSettings {
    access: IClubAccess;
    currentMembershipId: string;
    club: IClubSummary;
    permissions: TClubPermissions;
    entitlements: IClubEntitlements;
    visibility: IClubVisibility;
    members: IClubMember[];
    auditEvents: IClubAuditEvent[];
}

export interface IClubHubSession {
    id: string;
    phase: 'NOMINATION' | 'SELECTION' | 'WATCHING' | 'RATING' | 'COMPLETED' | 'CANCELLED';
    topic?: string;
    scheduledAt?: string;
    location?: string;
    updatedAt: string;
}

/** One authorized snapshot for every contextual section of the Club Hub. */
export interface IClubHub {
    access: IClubAccess;
    permissions: TClubPermissions;
    club: IClubSummary;
    memberCount: number;
    sessionCount: number;
    completedSessionCount: number;
    activeSession?: IClubHubSession;
    recentSessions: IClubHubSession[];
    ratingSessions: IClubHubSession[];
    historySessions: IClubHubSession[];
}

/** Why a Club request conflicted with current state; the web maps each to recovery copy. */
export const CLUB_CONFLICT_REASONS = [
    'CONFIRMATION_MISMATCH',
    'ADMIN_CLUB_LIMIT_REACHED',
    'ADMIN_MUST_TRANSFER',
    'SESSION_HISTORY',
    'CLUB_ARCHIVED',
    'TIER_SETTING_UNAVAILABLE',
    'MEMBERSHIP_INELIGIBLE',
] as const;

export type TClubConflictReason = (typeof CLUB_CONFLICT_REASONS)[number];
