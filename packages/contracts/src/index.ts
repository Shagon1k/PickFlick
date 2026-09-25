export const SERVICE_NAMES = {
    api: 'api',
    web: 'web',
    worker: 'worker',
} as const;

export type ServiceName = (typeof SERVICE_NAMES)[keyof typeof SERVICE_NAMES];

export interface ServiceStatus {
    readonly service: ServiceName;
    readonly status: 'scaffold';
}

export const DEPENDENCY_NAMES = ['database', 'redis', 'objectStorage'] as const;
export type DependencyName = (typeof DEPENDENCY_NAMES)[number];

export interface LivenessReport {
    readonly service: ServiceName;
    readonly status: 'alive';
    readonly revision?: string;
}

export interface DependencyStatus {
    readonly name: DependencyName;
    readonly status: 'up' | 'down';
}

export interface ReadinessReport {
    readonly status: 'ready' | 'not_ready';
    readonly checks: readonly DependencyStatus[];
}

export const API_ERROR_CODES = [
    'VALIDATION_FAILED',
    'UNAUTHORIZED',
    'FORBIDDEN',
    'NOT_FOUND',
    'METHOD_NOT_ALLOWED',
    'CONFLICT',
    'PAYLOAD_TOO_LARGE',
    'UNSUPPORTED_MEDIA_TYPE',
    'RATE_LIMITED',
    'SERVICE_UNAVAILABLE',
    'REQUEST_FAILED',
    'INTERNAL_ERROR',
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export interface ApiErrorEnvelope {
    readonly error: {
        readonly code: ApiErrorCode;
        readonly message: string;
        readonly requestId: string;
        /** Stable module-specific cause, such as a `ClubConflictReason`, when the code alone is ambiguous. */
        readonly reason?: string;
    };
}

export const CONTACT_MESSAGE_MAX_LENGTH = 500;
export const CONTACT_NAME_MAX_LENGTH = 100;
export const CONTACT_EMAIL_MAX_LENGTH = 254;

// Domain labels exclude dots, so matching stays linear instead of backtracking over the domain.
const emailAddressPattern = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/u;

/** A plain `local@domain.tld` address; length limits are checked separately by each form. */
export function isEmailAddress(value: string): boolean {
    return emailAddressPattern.test(value);
}

export interface ContactSubmissionRequest {
    readonly submissionKey: string;
    readonly message: string;
    readonly name?: string;
    readonly email?: string;
}

export interface ContactSubmissionResponse {
    readonly id: string;
    readonly status: 'accepted' | 'duplicate';
}

export const CLUB_POLICY_ACTIONS = [
    'viewClub',
    'participate',
    'leaveClub',
    'manageSessions',
    'manageMembers',
    'manageRoles',
    'manageSettings',
    'manageLifecycle',
    'viewAudit',
] as const;

export type ClubPolicyAction = (typeof CLUB_POLICY_ACTIONS)[number];
export type ClubPolicyPermissions = Readonly<Record<ClubPolicyAction, boolean>>;

export interface ClubTierProjection {
    readonly tier: 'FREE' | 'PRO';
    readonly adminClubLimit: number;
    readonly memberLimit: number;
    readonly blockingSessionLimit: 1;
    readonly inactivityGraceDays: number;
    readonly voteResultVisibility: 'ADMIN_HIDDEN' | 'ADMIN_CONFIGURABLE';
    readonly analyticsTier: 'BASIC' | 'EXTENDED';
}

export type ClubLifecycle = 'ACTIVE' | 'ARCHIVED';
export type ClubRole = 'ADMIN' | 'MODERATOR' | 'MEMBER';

export interface ClubPolicyProjection {
    readonly clubId: string;
    readonly lifecycle: ClubLifecycle;
    readonly membershipRole: ClubRole;
    readonly permissions: ClubPolicyPermissions;
    readonly entitlements: ClubTierProjection;
}

/** Why a Club request conflicted with current state; the web maps each to recovery copy. */
export const CLUB_CONFLICT_REASONS = [
    'CONFIRMATION_MISMATCH',
    'ADMIN_CLUB_LIMIT_REACHED',
    'ADMIN_MUST_TRANSFER',
    'SESSION_HISTORY',
    'CLUB_ARCHIVED',
    'TIER_SETTING_UNAVAILABLE',
    'OPERATION_REUSED',
    'MEMBERSHIP_INELIGIBLE',
] as const;
export type ClubConflictReason = (typeof CLUB_CONFLICT_REASONS)[number];

export const CLUB_AVATAR_MAX_BYTES = 512 * 1024;
export const CLUB_AVATAR_MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export type ClubAvatarMediaType = (typeof CLUB_AVATAR_MEDIA_TYPES)[number];

export const CLUB_NAME_MIN_LENGTH = 3;
export const CLUB_NAME_MAX_LENGTH = 100;
export const CLUB_DESCRIPTION_MAX_LENGTH = 500;

export interface ClubSummary {
    readonly id: string;
    readonly name: string;
    readonly description?: string;
    readonly hasAvatar: boolean;
    readonly avatarVersion?: string;
    readonly lifecycle: ClubLifecycle;
    readonly membershipRole: ClubRole;
    readonly selectionScaleMin: 0 | 1;
    readonly selectionScaleMax: number;
    readonly tier: 'FREE' | 'PRO';
}

export interface ClubCollectionResponse {
    readonly clubs: readonly ClubSummary[];
}

export interface CreateClubRequest {
    readonly name: string;
    readonly description?: string;
    readonly selectionScaleMin: 0 | 1;
    readonly selectionScaleMax: number;
}

export interface CreateClubResponse {
    readonly club: ClubSummary;
}

export interface ClubVisibilitySettings {
    readonly showNominationAuthors: boolean;
    readonly showNominationsBeforeSubmit: boolean;
    readonly showVoteResults: boolean;
    readonly showRatingResults: boolean;
    readonly useMonochromeMedia: boolean;
}

export interface ClubMemberProjection {
    readonly id: string;
    readonly displayName: string;
    readonly role: ClubRole;
    readonly joinedAt: string;
}

export const CLUB_AUDIT_ACTIONS = [
    'MEMBERSHIP_ROLE_CHANGED',
    'ADMIN_TRANSFERRED',
    'CLUB_SETTINGS_UPDATED',
    'CLUB_AVATAR_UPDATED',
    'CLUB_ARCHIVED',
    'CLUB_REACTIVATED',
    'MEMBERSHIP_LEFT',
    'CLUB_DELETED',
] as const;

export type ClubAuditAction = (typeof CLUB_AUDIT_ACTIONS)[number];

export interface ClubAuditProjection {
    readonly id: string;
    readonly action: ClubAuditAction;
    readonly changed: boolean;
    readonly createdAt: string;
}

export interface ClubSettingsProjection {
    readonly club: ClubSummary;
    readonly permissions: ClubPolicyPermissions;
    readonly entitlements: ClubTierProjection;
    readonly visibility: ClubVisibilitySettings;
    readonly members: readonly ClubMemberProjection[];
    readonly auditEvents: readonly ClubAuditProjection[];
}

export interface ClubOperationRequest {
    readonly operationId: string;
}

export interface ConfirmedClubOperationRequest extends ClubOperationRequest {
    readonly confirmation: string;
}

export interface UpdateClubSettingsRequest extends ClubOperationRequest, ClubVisibilitySettings {
    readonly name: string;
    readonly description?: string;
    readonly selectionScaleMin: 0 | 1;
    readonly selectionScaleMax: number;
}

export interface ChangeClubMemberRoleRequest extends ClubOperationRequest {
    readonly nextRole: 'MODERATOR' | 'MEMBER';
}

export type ClubLifecycleRequest =
    | ({ readonly action: 'reactivate' } & ClubOperationRequest)
    | ({ readonly action: 'archive' | 'delete' | 'leave' } & ConfirmedClubOperationRequest);

export interface ClubOperationReceipt {
    readonly changed: boolean;
    readonly replayed: boolean;
}

export interface UpdateClubSettingsResponse extends ClubOperationReceipt {
    readonly settings: ClubSettingsProjection;
}

export interface ClubAvatarResponse extends ClubOperationReceipt {
    readonly hasAvatar: boolean;
}

export const DEFAULT_AUTH_RETURN_TARGET = '/app';

const invitationAuthReturnTarget = /^\/invite\/(?:club|session)\/[A-Za-z0-9_-]{1,512}$/;
const clubAuthReturnTarget =
    /^\/clubs\/(?:new|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/settings)$/;

export function isAllowedAuthReturnTarget(value: unknown): value is string {
    if (
        typeof value !== 'string' ||
        value.length > 600 ||
        !value.startsWith('/') ||
        value.startsWith('//')
    ) {
        return false;
    }
    for (const character of value) {
        const codePoint = character.codePointAt(0) ?? 0;
        if (character === '\\' || codePoint <= 31 || codePoint === 127) {
            return false;
        }
    }
    return (
        value === DEFAULT_AUTH_RETURN_TARGET ||
        invitationAuthReturnTarget.test(value) ||
        clubAuthReturnTarget.test(value)
    );
}

export function resolveAuthReturnTarget(value: unknown): string {
    return isAllowedAuthReturnTarget(value) ? value : DEFAULT_AUTH_RETURN_TARGET;
}
