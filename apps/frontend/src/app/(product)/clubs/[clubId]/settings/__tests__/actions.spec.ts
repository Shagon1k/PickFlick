import { ApiError } from '@/lib/api.server';

import {
    changeClubMemberRoleAction,
    clubLifecycleAction,
    removeClubAvatarAction,
    updateClubSettingsAction,
    uploadClubAvatarAction,
} from '../actions';

const api = vi.hoisted(() => ({
    changeClubLifecycle: vi.fn(),
    changeMemberRole: vi.fn(),
    removeClubAvatar: vi.fn(),
    replaceClubAvatar: vi.fn(),
    updateClubSettings: vi.fn(),
}));
const navigation = vi.hoisted(() => ({ redirect: vi.fn() }));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => navigation);
vi.mock('@/api/clubs.server', () => api);
vi.mock('@/lib/api.server', () => ({
    ApiError: class extends Error {
        constructor(
            readonly status: number,
            readonly code?: string,
            readonly reason?: string,
        ) {
            super('API request failed.');
        }
    },
}));

const CLUB_ID = '10000000-0000-4000-8000-000000000031';
const MEMBERSHIP_ID = '10000000-0000-4000-8000-000000000041';
const previous = { message: '', revision: 2, status: 'idle' as const };

function formData(values: Record<string, string | File>): FormData {
    const result = new FormData();
    for (const [name, value] of Object.entries(values)) {
        result.set(name, value);
    }
    return result;
}

const settingsForm = () =>
    formData({
        name: 'Midnight Society',
        selectionScaleMin: '0',
        selectionScaleMax: '7',
        showVoteResults: 'on',
    });

const avatarForm = () =>
    formData({
        avatar: new File([new Uint8Array([137, 80, 78, 71])], 'avatar.png', { type: 'image/png' }),
    });

describe('Club settings actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        for (const request of Object.values(api)) {
            request.mockResolvedValue(undefined);
        }
    });

    it('should send parsed settings to the API', async () => {
        await expect(updateClubSettingsAction(CLUB_ID, previous, settingsForm())).resolves.toEqual({
            message: 'Club settings saved.',
            revision: 3,
            status: 'success',
        });
        expect(api.updateClubSettings).toHaveBeenCalledWith(CLUB_ID, {
            name: 'Midnight Society',
            selectionScaleMin: 0,
            selectionScaleMax: 7,
            showNominationAuthors: false,
            showNominationsBeforeSubmit: false,
            showVoteResults: true,
            showRatingResults: false,
            useMonochromeMedia: false,
        });
    });

    it('should reject invalid settings without calling the API', async () => {
        const form = settingsForm();
        form.set('selectionScaleMax', '0');

        await expect(updateClubSettingsAction(CLUB_ID, previous, form)).resolves.toMatchObject({
            status: 'error',
        });
        expect(api.updateClubSettings).not.toHaveBeenCalled();
    });

    it('should send the chosen member role', async () => {
        await changeClubMemberRoleAction(
            CLUB_ID,
            MEMBERSHIP_ID,
            previous,
            formData({ role: 'MODERATOR' }),
        );

        expect(api.changeMemberRole).toHaveBeenCalledWith(CLUB_ID, MEMBERSHIP_ID, {
            role: 'MODERATOR',
        });
    });

    it('should return recoverable state when the API is unreachable', async () => {
        for (const request of Object.values(api)) {
            request.mockRejectedValue(new TypeError('fetch failed'));
        }

        const results = await Promise.all([
            updateClubSettingsAction(CLUB_ID, previous, settingsForm()),
            changeClubMemberRoleAction(
                CLUB_ID,
                MEMBERSHIP_ID,
                previous,
                formData({ role: 'MEMBER' }),
            ),
            clubLifecycleAction(CLUB_ID, 'reactivate', previous, formData({})),
            uploadClubAvatarAction(CLUB_ID, previous, avatarForm()),
            removeClubAvatarAction(CLUB_ID, previous),
        ]);

        for (const result of results) {
            expect(result).toMatchObject({
                revision: 3,
                status: 'error',
                message: expect.stringContaining('Reload'),
            });
        }
    });

    it('should explain a reactivation blocked by the administered Club limit', async () => {
        api.changeClubLifecycle.mockRejectedValueOnce(
            new ApiError(409, 'CONFLICT', 'ADMIN_CLUB_LIMIT_REACHED'),
        );

        await expect(
            clubLifecycleAction(CLUB_ID, 'reactivate', previous, formData({})),
        ).resolves.toMatchObject({
            message: expect.stringContaining('most active Clubs your plan allows'),
            status: 'error',
        });
    });

    it('should leave the settings page after deleting the Club', async () => {
        await clubLifecycleAction(
            CLUB_ID,
            'delete',
            previous,
            formData({ confirmation: 'Midnight Society' }),
        );

        expect(api.changeClubLifecycle).toHaveBeenCalledWith(CLUB_ID, 'delete', 'Midnight Society');
        expect(navigation.redirect).toHaveBeenCalledWith('/app');
    });
});
