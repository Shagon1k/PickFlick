'use server';

import {
    createSessionSchema,
    HTTP_STATUS,
    type TSession,
    updateSessionSchema,
} from '@pickflick/contracts';
import { revalidatePath } from 'next/cache';

import { createSession, updateSession } from '@/api/sessions.server';
import { getFailureMessage, type IFailureCopy } from '@/lib/action-failure';

const SAVE_FAILURE: IFailureCopy = {
    reasons: {
        BLOCKING_SESSION:
            'This Club already has a Session in Nomination, Selection, or Watching. Open the Club Hub to view it.',
        SESSION_CHANGED: 'This Session changed. Reload to see the latest details before editing.',
        SESSION_CLOSED: 'This Session is closed. Reload to view its current state.',
        CLUB_READ_ONLY: 'This Club is read-only. Return to the Club Hub for details.',
        MOVIE_UNAVAILABLE: 'The selected Movie is unavailable. Choose another film.',
        DEADLINE_PAST: 'The nomination deadline has passed. Choose a new deadline.',
    },
    statuses: [
        [
            [HTTP_STATUS.UNAUTHORIZED],
            'Your sign-in expired. Sign in again; your entries are still here.',
        ],
        [
            [HTTP_STATUS.FORBIDDEN, HTTP_STATUS.NOT_FOUND],
            'You no longer have permission to manage this Session.',
        ],
    ],
    fallback: 'We could not save your Session. Your entries are still here; try again.',
    request: 'Session save',
};

export async function saveSessionAction(clubId: string, id: string | null, input: unknown) {
    try {
        const session = await sendSession(clubId, id, input);
        if (!session)
            return { ok: false as const, message: 'Review the highlighted fields and try again.' };
        revalidatePath(`/clubs/${session.clubId}`);
        revalidatePath(`/sessions/${session.id}`);
        return { ok: true as const, session };
    } catch (error) {
        return { ok: false as const, message: getFailureMessage(error, SAVE_FAILURE) };
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
