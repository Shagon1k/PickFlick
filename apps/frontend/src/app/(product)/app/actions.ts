'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { getClubHub, listClubs } from '@/api/clubs.server';
import { ApiError } from '@/lib/api.server';

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
        if (error instanceof ApiError && error.status === 404) {
            redirect('/app');
        }
        throw error;
    }
    (await cookies()).set('pickflick.last_club', club.id, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
    });
    redirect(`/clubs/${club.id}`);
}
