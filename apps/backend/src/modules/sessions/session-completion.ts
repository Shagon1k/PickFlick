import type { Prisma } from '@pickflick/database';

import { completeNomination } from './nominations/nomination-completion.js';
import { completeSelection } from './selection/selection-completion.js';

/** Roster and lifecycle writers already hold Club → Session locks. Publish one progress event. */
export async function completeSessionPhase(tx: Prisma.TransactionClient, sessionId: string) {
    const session = await tx.session.findUniqueOrThrow({ where: { id: sessionId } });
    if (session.phase === 'SELECTION') {
        await completeSelection(tx, sessionId);
        return;
    }
    await completeNomination(tx, sessionId);
}
