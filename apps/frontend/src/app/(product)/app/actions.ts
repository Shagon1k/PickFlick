'use server';

import { HTTP_STATUS } from '@pickflick/contracts';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getClubHub, listClubs } from '#api/clubs.server';
import { ApiError } from '#lib/api.server';
import { LAST_CLUB_COOKIE, LAST_CLUB_COOKIE_OPTIONS } from '#lib/last-club';

/** Save the preference only after both the list and the Hub authorize this Membership. */
export async function selectClubAction(formData: FormData): Promise<void> {
    const requested = formData.get('clubId');
    const clubs = await listClubs();
    const club = clubs.find(({ id }) => id === requested);
    if (!club) {
        redirect('/app');
    }
    try {
        await getClubHub(club.id);
    } catch (error) {
        if (error instanceof ApiError && error.status === HTTP_STATUS.NOT_FOUND) {
            redirect('/app');
        }
        throw error;
    }
    (await cookies()).set(LAST_CLUB_COOKIE, club.id, LAST_CLUB_COOKIE_OPTIONS);
    redirect(`/clubs/${club.id}`);
}
