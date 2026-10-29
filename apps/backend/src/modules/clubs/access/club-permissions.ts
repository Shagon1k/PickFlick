import type {
    IClubAccess,
    TClubLifecycle,
    TClubPermissions,
    TClubRole,
} from '@pickflick/contracts';

/**
 * What the member may do. Pages use these flags to choose controls, and services enforce the same
 * flags: `manageSessions` is the Session management rule. Loosening one loosens the server too.
 */
export function getClubPermissions(
    role: TClubRole,
    lifecycle: TClubLifecycle,
    access: IClubAccess,
): TClubPermissions {
    const isAdmin = role === 'ADMIN';
    const isActive = lifecycle === 'ACTIVE';
    return {
        viewClub: true,
        participate: isActive,
        leaveClub: !isAdmin,
        manageSessions: isActive && role !== 'MEMBER' && access.newWorkAllowed,
        createInvitations:
            isActive && role !== 'MEMBER' && access.newWorkAllowed && !access.isAtCapacity,
        manageMembers: isActive && role !== 'MEMBER',
        manageRoles: isActive && isAdmin,
        manageSettings: isActive && isAdmin,
        manageLifecycle: isAdmin,
        viewAudit: isAdmin,
    };
}

/** Admins remove Members and Moderators, Moderators remove Members; nobody removes the Admin. */
export function canRemoveMember(
    actor: { id: string; role: TClubRole },
    target: { id: string; role: TClubRole },
    lifecycle: TClubLifecycle,
): boolean {
    if (lifecycle !== 'ACTIVE' || actor.role === 'MEMBER') return false;
    if (target.role === 'ADMIN' || target.id === actor.id) return false;
    return actor.role === 'ADMIN' || target.role === 'MEMBER';
}
