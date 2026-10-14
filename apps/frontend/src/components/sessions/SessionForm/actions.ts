'use server';

import {
    createSessionSchema,
    HTTP_STATUS,
    type TSession,
    updateSessionSchema,
} from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { createSession, updateSession } from '@/api/sessions.server';
import { ApiError } from '@/lib/api.server';

const NO_PERMISSION_STATUSES = [HTTP_STATUS.FORBIDDEN, HTTP_STATUS.NOT_FOUND];

export async function saveSessionAction(clubId: string, id: string | null, input: unknown) {
    if (!z.uuid().safeParse(clubId).success || (id !== null && !z.uuid().safeParse(id).success)) {
        return {
            ok: false as const,
            message: 'This Session address is invalid. Return to the Club Hub.',
        };
    }
    try {
        const session = await sendSession(clubId, id, input);
        if (!session)
            return { ok: false as const, message: 'Review the highlighted fields and try again.' };
        revalidatePath(`/clubs/${session.clubId}`);
        revalidatePath(`/sessions/${session.id}`);
        return { ok: true as const, session };
    } catch (error) {
        return saveFailure(error);
    }
}

/** Validates the input against the schema for its action once, then sends it; null when invalid. */
async function sendSession(
    clubId: string,
    id: string | null,
    input: unknown,
): Promise<TSession | null> {
    if (id) {
        const parsed = updateSessionSchema.safeParse(input);
        return parsed.success ? updateSession(id, parsed.data) : null;
    }
    const parsed = createSessionSchema.safeParse(input);
    return parsed.success ? createSession(clubId, parsed.data) : null;
}

function saveFailure(error: unknown) {
    if (error instanceof ApiError) {
        if (error.status === HTTP_STATUS.UNAUTHORIZED)
            return {
                ok: false as const,
                message: 'Your sign-in expired. Sign in again; your entries are still here.',
            };
        if (NO_PERMISSION_STATUSES.includes(error.status))
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
