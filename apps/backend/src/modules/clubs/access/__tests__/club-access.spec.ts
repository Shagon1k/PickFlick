import { clubAccess } from '../club-access.js';
import { clubPermissions } from '../club-permissions.js';

describe('clubAccess', () => {
    it('should keep a Club at capacity writable and make an over-limit Club read-only for new work', () => {
        expect(clubAccess('ACTIVE', true, 8, 8)).toEqual({
            adminless: false,
            newWorkAllowed: true,
            reasons: [],
        });
        const access = clubAccess('ACTIVE', true, 9, 8);
        expect(access.reasons).toEqual(['MEMBER_LIMIT']);
        expect(clubPermissions('ADMIN', 'ACTIVE', access)).toMatchObject({
            createInvitations: false,
            manageSessions: false,
            manageMembers: true,
            manageSettings: true,
            participate: true,
        });
    });
    it('should preserve participation and leaving in an adminless Club while disabling new work', () => {
        const access = clubAccess('ACTIVE', false, 2, 8);
        expect(access).toEqual({ adminless: true, newWorkAllowed: false, reasons: ['ADMINLESS'] });
        expect(clubPermissions('MODERATOR', 'ACTIVE', access)).toMatchObject({
            viewClub: true,
            participate: true,
            leaveClub: true,
            manageSettings: false,
            createInvitations: false,
            manageSessions: false,
        });
    });
    it('should report every restriction while keeping archived history readable', () => {
        const access = clubAccess('ARCHIVED', false, 9, 8);
        expect(access.reasons).toEqual(['ARCHIVED', 'ADMINLESS', 'MEMBER_LIMIT']);
        expect(clubPermissions('MEMBER', 'ARCHIVED', access)).toMatchObject({
            viewClub: true,
            participate: false,
            leaveClub: true,
            manageMembers: false,
        });
    });
});
