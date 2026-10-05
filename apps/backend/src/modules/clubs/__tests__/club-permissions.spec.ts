import { clubPermissions } from '../club-permissions.js';

describe('clubPermissions', () => {
    it('should let an active Admin manage everything except leaving', () => {
        expect(clubPermissions('ADMIN', 'ACTIVE')).toEqual({
            viewClub: true,
            participate: true,
            leaveClub: false,
            createInvitations: true,
            manageSessions: true,
            manageMembers: true,
            manageRoles: true,
            manageSettings: true,
            manageLifecycle: true,
            viewAudit: true,
        });
    });

    it('should let a Moderator run Sessions but not settings', () => {
        expect(clubPermissions('MODERATOR', 'ACTIVE')).toMatchObject({
            manageSessions: true,
            manageSettings: false,
            leaveClub: true,
        });
    });

    it('should leave an archived Club read-only apart from lifecycle and leaving', () => {
        expect(clubPermissions('ADMIN', 'ARCHIVED')).toMatchObject({
            participate: false,
            manageSettings: false,
            manageLifecycle: true,
        });
        expect(clubPermissions('MEMBER', 'ARCHIVED')).toMatchObject({
            participate: false,
            leaveClub: true,
        });
    });
});
