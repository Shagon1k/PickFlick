'use server';

import { createSessionSchema, updateSessionSchema } from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createSession, updateSession } from '@/api/sessions.server';
import { ApiError } from '@/lib/api.server';

export async function saveSessionAction(clubId: string, id: string | null, input: unknown) {
    if (!z.uuid().safeParse(clubId).success || (id !== null && !z.uuid().safeParse(id).success)) {
        return {
            ok: false as const,
            message: 'This Session address is invalid. Return to the Club Hub.',
        };
    }
    const parsed = id ? updateSessionSchema.safeParse(input) : createSessionSchema.safeParse(input);
    if (!parsed.success)
        return { ok: false as const, message: 'Review the highlighted fields and try again.' };
    try {
        const session = id
            ? await updateSession(id, updateSessionSchema.parse(parsed.data))
            : await createSession(clubId, createSessionSchema.parse(parsed.data));
        revalidatePath(`/clubs/${session.clubId}`);
        revalidatePath(`/sessions/${session.id}`);
        return { ok: true as const, session };
    } catch (error) {
        return saveFailure(error);
    }
}

function saveFailure(error: unknown) {
    if (error instanceof ApiError) {
        if (error.status === 401)
            return {
                ok: false as const,
                message: 'Your sign-in expired. Sign in again; your entries are still here.',
            };
        if ([403, 404].includes(error.status))
            return {
                ok: false as const,
                message: 'You no longer have permission to manage this Session.',
            };
        const messages: Record<string, string> = {
            BLOCKING_SESSION:
                'This Club already has a Session in Nomination, Selection, or Watching. Open the Club Hub to view it.',
            SESSION_CHANGED:
                'This Session changed. Reload to see the latest details before editing.',
            SESSION_CLOSED: 'This Session is closed. Reload to view its current state.',
            CLUB_READ_ONLY: 'This Club is read-only. Return to the Club Hub for details.',
            MOVIE_UNAVAILABLE: 'The selected Movie is unavailable. Choose another film.',
            DEADLINE_PAST: 'The nomination deadline has passed. Choose a new deadline.',
        };
        const message = error.reason ? messages[error.reason] : undefined;
        if (message) return { ok: false as const, message };
    }
    console.error('Session save failed.');
    return {
        ok: false as const,
        message: 'We could not save your Session. Your entries are still here; try again.',
    };
}
