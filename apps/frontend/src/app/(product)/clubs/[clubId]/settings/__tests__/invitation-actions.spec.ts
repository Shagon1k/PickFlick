import type { ICreatedInvitation, IManagedInvitation } from '@pickflick/contracts';

import { manageInvitationsAction } from '../invitation-actions';

const api = vi.hoisted(() => ({
    createInvitation: vi.fn<() => Promise<ICreatedInvitation>>(),
    listInvitations: vi.fn<() => Promise<IManagedInvitation[]>>(),
    revokeInvitation: vi.fn<() => Promise<void>>(),
}));
vi.mock('@/api/invitations.server', () => api);

const CLUB_ID = '10000000-0000-4000-8000-000000000031';
const created = {
    id: '60000000-0000-4000-8000-000000000034',
    token: 'v'.repeat(43),
    expiresAt: '2026-10-10T12:00:00.000Z',
};
const invitations: IManagedInvitation[] = [
    { id: created.id, expiresAt: created.expiresAt, state: 'pending' },
];

describe('Invitation management action', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        api.createInvitation.mockResolvedValue(created);
        api.listInvitations.mockResolvedValue(invitations);
    });

    it('should return the created token and refreshed list', async () => {
        await expect(manageInvitationsAction(CLUB_ID)).resolves.toEqual({
            ok: true,
            created,
            invitations,
        });
    });

    it('should preserve creation when only the list refresh fails', async () => {
        api.listInvitations.mockRejectedValue(new TypeError('fetch failed'));

        await expect(manageInvitationsAction(CLUB_ID)).resolves.toEqual({
            ok: true,
            created,
            refreshError:
                'Invitation list could not be refreshed. Use Recent invitations to try again.',
        });
        expect(api.createInvitation).toHaveBeenCalledExactlyOnceWith(CLUB_ID);
    });

    it('should report creation failure without fetching the list', async () => {
        api.createInvitation.mockRejectedValue(new TypeError('fetch failed'));

        await expect(manageInvitationsAction(CLUB_ID)).resolves.toMatchObject({ ok: false });
        expect(api.listInvitations).not.toHaveBeenCalled();
    });
});
