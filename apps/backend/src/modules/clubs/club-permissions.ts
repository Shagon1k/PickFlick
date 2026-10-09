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
