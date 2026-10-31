import { getClubAccess } from '../club-access.js';
import { getClubPermissions } from '../club-permissions.js';

const OPEN = getClubAccess('ACTIVE', true, 2, 8);

describe('getClubPermissions', () => {
    it('should let an active Admin manage everything except leaving', () => {
        expect(getClubPermissions('ADMIN', 'ACTIVE', OPEN)).toEqual({
            viewClub: true,
            participate: true,
            leaveClub: false,
            createInvitations: true,
            manageSessions: true,
            manageMembers: true,
            manageRoles: true,
            manageSettings: true,
            manageLifecycle: true,
        });
    });

    it('should let a Moderator run Sessions but not settings', () => {
        expect(getClubPermissions('MODERATOR', 'ACTIVE', OPEN)).toMatchObject({
            manageSessions: true,
            manageSettings: false,
            leaveClub: true,
        });
    });

    it('should leave an archived Club read-only apart from lifecycle and leaving', () => {
        expect(getClubPermissions('ADMIN', 'ARCHIVED', OPEN)).toMatchObject({
            participate: false,
            manageSettings: false,
            manageLifecycle: true,
        });
        expect(getClubPermissions('MEMBER', 'ARCHIVED', OPEN)).toMatchObject({
            participate: false,
            leaveClub: true,
        });
    });

    it('should stop invitations in a full Club, as the invitation service does', () => {
        expect(
            getClubPermissions('ADMIN', 'ACTIVE', getClubAccess('ACTIVE', true, 8, 8)),
        ).toMatchObject({ createInvitations: false, manageSessions: true });
    });
});
