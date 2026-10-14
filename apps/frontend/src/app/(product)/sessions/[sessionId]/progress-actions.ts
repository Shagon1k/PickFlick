'use server';

import { getSessionProgress } from '@/api/sessions.server';
import { ApiError } from '@/lib/api.server';
import { ACCESS_LOST_STATUSES } from '@/lib/http-status';

export async function getSessionProgressAction(id: string) {
    try {
        return { state: 'ready' as const, ...(await getSessionProgress(id)) };
    } catch (error) {
        if (error instanceof ApiError && ACCESS_LOST_STATUSES.includes(error.status))
            return { state: 'denied' as const };
        console.error('Session progress refresh failed.');
        return { state: 'unavailable' as const };
    }
}
