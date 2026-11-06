import type { Prisma } from '@pickflick/database';

import { completeNomination } from './nominations/nomination-completion.js';
import { completeRating } from './rating/rating-completion.js';
import { completeSelection } from './selection/selection-completion.js';
import { publishProgress } from './session-progress.js';

/**
 * After a roster change, finishes the current phase if every accepted participant has acted.
 * Roster and lifecycle writers already hold Club → Session locks. Publishes one progress event.
 */
export async function completeSessionPhase(tx: Prisma.TransactionClient, sessionId: string) {
    const { phase } = await tx.session.findUniqueOrThrow({
        where: { id: sessionId },
        select: { phase: true },
    });
    if (phase === 'NOMINATION') return completeNomination(tx, sessionId);
    if (phase === 'SELECTION') return completeSelection(tx, sessionId);
    if (phase === 'RATING') return completeRating(tx, sessionId);
    // Watching has no completion rule; the roster still changed.
    await publishProgress(tx, sessionId, 'PROGRESS');
}
