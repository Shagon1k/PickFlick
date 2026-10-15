import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@pickflick/database';

import { publishProgress } from '../session-progress.js';
import { type ISelectionInputs, resolveSelection } from './selection-winner.js';

/** The caller holds Club → Session locks through the snapshot and transition. */
export async function advanceSelection(
    tx: Prisma.TransactionClient,
    session: Prisma.SessionGetPayload<object>,
    closure: { kind: 'AUTOMATIC' | 'MANUAL'; membershipId: string | null },
) {
    const nominations = await tx.nomination.findMany({
        where: { sessionId: session.id, isInSelection: true },
        include: { movie: { select: { externalIds: { orderBy: { source: 'asc' } } } } },
        orderBy: { id: 'asc' },
    });
    if (nominations.length === 0) throw new ConflictException({ reason: 'NO_NOMINATIONS' });
    const ballots = await tx.selectionBallot.findMany({
        where: { sessionId: session.id },
        include: { scores: { orderBy: { nominationId: 'asc' } } },
        orderBy: { id: 'asc' },
    });
    const participants = await tx.sessionParticipant.findMany({
        where: { sessionId: session.id, status: 'ACCEPTED' },
        select: { id: true },
        orderBy: { id: 'asc' },
    });
    const inputs: ISelectionInputs = {
        scaleMin: session.selectionScaleMin,
        scaleMax: session.selectionScaleMax,
        acceptedParticipantIds: participants.map((participant) => participant.id),
        nominations: nominations.map((nomination) => ({
            id: nomination.id,
            movieId: nomination.movieId,
            submittedAt: nomination.submittedAt.toISOString(),
            externalIds: nomination.movie.externalIds.map(({ source, externalId }) => ({
                source,
                externalId,
            })),
        })),
        ballots: ballots.map((ballot) => ({
            id: ballot.id,
            participantId: ballot.participantId,
            submittedAt: ballot.submittedAt.toISOString(),
            scores: ballot.scores.map(({ nominationId, score }) => ({ nominationId, score })),
        })),
    };
    const result = resolveSelection(inputs);
    await tx.session.update({
        where: { id: session.id },
        data: {
            phase: 'WATCHING',
            movieId: result.movieId,
            selectionResult: {
                ...result,
                inputs: { ...inputs },
                closure,
                closedAt: new Date().toISOString(),
            },
            phaseVersion: { increment: 1 },
            detailsVersion: { increment: 1 },
        },
    });
    await publishProgress(tx, session.id, closure.kind);
}

export async function completeSelection(tx: Prisma.TransactionClient, sessionId: string) {
    const session = await tx.session.findUniqueOrThrow({
        where: { id: sessionId },
        include: { club: true },
    });
    if (session.phase === 'SELECTION' && session.club.lifecycle === 'ACTIVE') {
        const participants = await tx.sessionParticipant.findMany({
            where: { sessionId, status: 'ACCEPTED' },
            select: { selectionBallot: { select: { id: true } } },
        });
        if (
            participants.length > 0 &&
            participants.every((participant) => participant.selectionBallot)
        ) {
            await advanceSelection(tx, session, { kind: 'AUTOMATIC', membershipId: null });
            return;
        }
    }
    await publishProgress(tx, sessionId, 'PROGRESS');
}
