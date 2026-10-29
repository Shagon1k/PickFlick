import { ConflictException, Injectable } from '@nestjs/common';
import type { TOpenRating } from '@pickflick/contracts';

import { recordAudit } from '../../clubs/access/club-access.js';
import { Transactions } from '../../notifications/transactions.js';
import { assertManager } from '../session-access.js';
import { lockSessionForMember } from '../session-lock.js';
import { publishProgress } from '../session-progress.js';

@Injectable()
export class WatchingService {
    constructor(private readonly transactions: Transactions) {}

    async openRating(userId: string, id: string, input: TOpenRating): Promise<void> {
        await this.transactions.write(async (tx) => {
            const { session, membership } = await lockSessionForMember(tx, userId, id);
            await assertManager(tx, membership);
            if (session.phase === 'RATING') return;
            if (session.phase !== 'WATCHING' || session.phaseVersion !== input.phaseVersion)
                throw new ConflictException({ reason: 'WATCHING_CHANGED' });
            // Leaving Watching releases the partial unique index's Club slot in this transaction.
            await tx.session.update({
                where: { id },
                data: {
                    phase: 'RATING',
                    phaseVersion: { increment: 1 },
                    detailsVersion: { increment: 1 },
                },
            });
            await recordAudit(tx, {
                clubId: session.clubId,
                sessionId: id,
                actorUserId: userId,
                subjectUserId: userId,
                subjectMembershipId: membership.id,
                action: 'SESSION_RATING_OPENED',
            });
            await publishProgress(tx, id, 'MANUAL');
        });
    }
}
