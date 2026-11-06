import { NotFoundException } from '@nestjs/common';
import { HUB_HISTORY_LIMIT, type IClubSessionHistoryPage } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import { findMembership } from './access/club-access.js';
import { createHubSessionProjection, sessionInclude } from './club-session-projection.js';

export async function readClubSessionHistory(
    tx: Prisma.TransactionClient,
    userId: string,
    clubId: string,
    cursor?: string,
): Promise<IClubSessionHistoryPage> {
    const membership = await findMembership(tx, userId, clubId);
    const page = await loadClubSessionHistory(tx, clubId, cursor);
    const toHubSession = await createHubSessionProjection(tx, membership, page.sessions);
    return { sessions: page.sessions.map(toHubSession), nextCursor: page.nextCursor };
}

export async function loadClubSessionHistory(
    tx: Prisma.TransactionClient,
    clubId: string,
    cursor?: string,
) {
    const position = cursor
        ? await tx.session.findFirst({
              where: { id: cursor, clubId, phase: { in: ['COMPLETED', 'CANCELLED'] } },
              select: { id: true, updatedAt: true },
          })
        : null;
    if (cursor && !position) throw new NotFoundException();
    const rows = await tx.session.findMany({
        where: {
            clubId,
            phase: { in: ['COMPLETED', 'CANCELLED'] },
            ...(position
                ? {
                      OR: [
                          { updatedAt: { lt: position.updatedAt } },
                          { updatedAt: position.updatedAt, id: { lt: position.id } },
                      ],
                  }
                : {}),
        },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: HUB_HISTORY_LIMIT + 1,
        include: sessionInclude,
    });
    const sessions = rows.slice(0, HUB_HISTORY_LIMIT);
    return {
        sessions,
        nextCursor: rows.length > HUB_HISTORY_LIMIT ? sessions.at(-1)!.id : null,
    };
}
