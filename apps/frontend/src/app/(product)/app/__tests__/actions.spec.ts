import { ApiError } from '#lib/api.server';

import { selectClubAction } from '../actions';

const api = vi.hoisted(() => ({ getClubHub: vi.fn(), listClubs: vi.fn() }));
const preference = vi.hoisted(() => ({ set: vi.fn() }));
const navigation = vi.hoisted(() => ({
    redirect: vi.fn<(path: string) => never>((path) => {
        throw new Error(`Redirect: ${path}`);
    }),
}));

vi.mock('#api/clubs.server', () => api);
vi.mock('next/headers', () => ({ cookies: () => Promise.resolve(preference) }));
vi.mock('next/navigation', () => navigation);

const CLUB_ID = '10000000-0000-4000-8000-000000000031';
const selection = () => {
    const form = new FormData();
    form.set('clubId', CLUB_ID);
    return form;
};

describe('selectClubAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        api.listClubs.mockResolvedValue([{ id: CLUB_ID }]);
        api.getClubHub.mockResolvedValue(undefined);
    });

    it('should save the preference and open a Club after Hub authorization', async () => {
        await expect(selectClubAction(selection())).resolves.toBe(`/clubs/${CLUB_ID}`);

        expect(api.getClubHub).toHaveBeenCalledWith(CLUB_ID);
        expect(preference.set).toHaveBeenCalledWith('pickflick.last_club', CLUB_ID, {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            path: '/',
        });
    });

    it('should recheck current Clubs without saving a preference after Membership revocation', async () => {
        api.getClubHub.mockRejectedValueOnce(new ApiError(404));

        await expect(selectClubAction(selection())).rejects.toThrow('Redirect: /app');

        expect(navigation.redirect).toHaveBeenCalledWith('/app');
        expect(preference.set).not.toHaveBeenCalled();
    });

    it('should return to current Clubs when the selection is absent from Memberships', async () => {
        api.listClubs.mockResolvedValueOnce([]);

        await expect(selectClubAction(selection())).rejects.toThrow('Redirect: /app');

        expect(api.getClubHub).not.toHaveBeenCalled();
        expect(preference.set).not.toHaveBeenCalled();
    });

    it('should propagate other Hub failures without changing the preference', async () => {
        const error = new ApiError(503);
        api.getClubHub.mockRejectedValueOnce(error);

        await expect(selectClubAction(selection())).rejects.toBe(error);

        expect(navigation.redirect).not.toHaveBeenCalled();
        expect(preference.set).not.toHaveBeenCalled();
    });
});
