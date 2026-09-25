import type { ClubPolicyPermissions } from '@pickflick/contracts';
import type { AppRole, ClubLifecycle, ClubRole, UserStatus } from '@pickflick/database';

export interface ClubPolicySubject {
    readonly appRole: AppRole;
    readonly clubRole: ClubRole | null;
    readonly lifecycle: ClubLifecycle | null;
    readonly userStatus: UserStatus;
}

type MutableClubPolicyPermissions = {
    -readonly [Action in keyof ClubPolicyPermissions]: boolean;
};

function deniedPermissions(): MutableClubPolicyPermissions {
    return {
        viewClub: false,
        participate: false,
        leaveClub: false,
        manageSessions: false,
        manageMembers: false,
        manageRoles: false,
        manageSettings: false,
        manageLifecycle: false,
        viewAudit: false,
    };
}

/**
 * Projects UI capabilities from authoritative state. Every mutation must still authorize the
 * concrete action again inside its transaction.
 */
export function projectClubPermissions(subject: ClubPolicySubject): ClubPolicyPermissions {
    const permissions = deniedPermissions();
    if (subject.userStatus !== 'ACTIVE' || !subject.clubRole || !subject.lifecycle) {
        return permissions;
    }

    permissions.viewClub = true;
    permissions.leaveClub = subject.clubRole !== 'ADMIN';

    if (subject.clubRole === 'ADMIN') {
        permissions.manageLifecycle = true;
        permissions.viewAudit = true;
    }

    if (subject.lifecycle !== 'ACTIVE') {
        return permissions;
    }

    permissions.participate = true;
    permissions.manageSessions = subject.clubRole === 'ADMIN' || subject.clubRole === 'MODERATOR';
    if (subject.clubRole === 'ADMIN') {
        permissions.manageMembers = true;
        permissions.manageRoles = true;
        permissions.manageSettings = true;
    }
    return permissions;
}
