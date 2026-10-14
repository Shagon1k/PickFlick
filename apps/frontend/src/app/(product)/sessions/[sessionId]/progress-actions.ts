'use server';

import { z } from 'zod';

import { getSessionProgress } from '@/api/sessions.server';
import { ApiError } from '@/lib/api.server';

export async function getSessionProgressAction(id: string) {
    if (!z.uuidv4().safeParse(id).success) return { state: 'denied' as const };
    try {
        return { state: 'ready' as const, ...(await getSessionProgress(id)) };
    } catch (error) {
        if (error instanceof ApiError && [401, 403, 404].includes(error.status))
            return { state: 'denied' as const };
        console.error('Session progress refresh failed.');
        return { state: 'unavailable' as const };
    }
}
