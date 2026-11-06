import { getClubAccess } from '../club-access.js';
import { getClubPermissions } from '../club-permissions.js';

describe('getClubAccess', () => {
    it('should keep a Club at capacity writable and make an over-limit Club read-only for new work', () => {
        expect(getClubAccess('ACTIVE', true, 8, 8)).toEqual({
            adminless: false,
            newWorkAllowed: true,
            isAtCapacity: true,
            reasons: [],
        });
        const access = getClubAccess('ACTIVE', true, 9, 8);
        expect(access.reasons).toEqual(['MEMBER_LIMIT']);
        expect(getClubPermissions('ADMIN', 'ACTIVE', access)).toMatchObject({
            createInvitations: false,
            manageSessions: false,
            manageMembers: true,
            manageSettings: true,
            participate: true,
        });
    });
    it('should preserve participation and leaving in an adminless Club while disabling new work', () => {
        const access = getClubAccess('ACTIVE', false, 2, 8);
        expect(access).toEqual({
            adminless: true,
            newWorkAllowed: false,
            isAtCapacity: false,
            reasons: ['ADMINLESS'],
        });
        expect(getClubPermissions('MODERATOR', 'ACTIVE', access)).toMatchObject({
            viewClub: true,
            participate: true,
            leaveClub: true,
            manageSettings: false,
            createInvitations: false,
            manageSessions: false,
        });
    });
    it('should report every restriction while keeping archived history readable', () => {
        const access = getClubAccess('ARCHIVED', false, 9, 8);
        expect(access.reasons).toEqual(['ARCHIVED', 'ADMINLESS', 'MEMBER_LIMIT']);
        expect(getClubPermissions('MEMBER', 'ARCHIVED', access)).toMatchObject({
            viewClub: true,
            participate: false,
            leaveClub: true,
            manageMembers: false,
        });
    });
});
