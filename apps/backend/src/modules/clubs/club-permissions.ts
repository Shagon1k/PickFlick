import type {
    IClubAccess,
    TClubLifecycle,
    TClubPermissions,
    TClubRole,
} from '@pickflick/contracts';

/**
 * What the member may do in the UI. Every mutation still checks its own rule on the server; this
 * only decides which controls to show.
 */
export function clubPermissions(
    role: TClubRole,
    lifecycle: TClubLifecycle,
    access?: IClubAccess,
): TClubPermissions {
    const admin = role === 'ADMIN';
    const active = lifecycle === 'ACTIVE';
    return {
        viewClub: true,
        participate: active,
        leaveClub: !admin,
        manageSessions: active && role !== 'MEMBER' && (access?.newWorkAllowed ?? true),
        createInvitations: active && role !== 'MEMBER' && (access?.newWorkAllowed ?? true),
        manageMembers: active && role !== 'MEMBER',
        manageRoles: active && admin,
        manageSettings: active && admin,
        manageLifecycle: admin,
        viewAudit: admin,
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
