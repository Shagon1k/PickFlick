import { selectionScaleMinSchema, type TSelectionScores } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

import type { TMembership } from '../../clubs/access/club-access.js';
import type { MoviesService } from '../../movies/movies.service.js';
import { canViewSelectionScores } from '../session-visibility.js';
import { selectionScoresSnapshotSchema } from './selection-result.js';

interface IScoreSource {
    films: { nominationId: string; movieId: string }[];
    ballots: {
        participantId: string;
        membershipId: string;
        author: string;
        scores: { nominationId: string; score: number }[];
    }[];
}

export async function loadSelectionScores(
    tx: Prisma.TransactionClient,
    session: Prisma.SessionGetPayload<object>,
    membership: TMembership,
    moviesService: MoviesService,
): Promise<TSelectionScores | null> {
    if (!canViewSelectionScores(session, true)) return null;
    const source =
        session.type === 'PAST'
            ? await readPastScores(tx, session.id)
            : session.selectionResult !== null
              ? await readFrozenScores(tx, session)
              : session.phase === 'SELECTION'
                ? await readLiveScores(tx, session.id)
                : null;
    if (!source) return null;
    const hasSubmitted = source.ballots.some((ballot) => ballot.membershipId === membership.id);
    if (!canViewSelectionScores(session, hasSubmitted)) return null;
    const movies = await moviesService.findSummaries(
        tx,
        source.films.map((film) => film.movieId),
    );
    return {
        scaleMin: selectionScaleMinSchema.parse(session.selectionScaleMin),
        scaleMax: session.selectionScaleMax,
        films: source.films.map(({ nominationId, movieId }) => ({
            nominationId,
            movie: movies.get(movieId)!,
        })),
        ballots: source.ballots.map(({ participantId, author, scores }) => ({
            participantId,
            author,
            scores,
        })),
    };
}

async function readLiveScores(
    tx: Prisma.TransactionClient,
    sessionId: string,
): Promise<IScoreSource> {
    const [nominations, ballots] = await Promise.all([
        tx.nomination.findMany({
            where: { sessionId, isInSelection: true },
            orderBy: [{ submittedAt: 'asc' }, { id: 'asc' }],
            select: { id: true, movieId: true },
        }),
        tx.selectionBallot.findMany({
            where: { sessionId },
            orderBy: { id: 'asc' },
            include: {
                scores: { select: { nominationId: true, score: true } },
                participant: {
                    select: {
                        membershipId: true,
                        membership: { select: { user: { select: { displayName: true } } } },
                    },
                },
            },
        }),
    ]);
    return {
        films: nominations.map(({ id, movieId }) => ({ nominationId: id, movieId })),
        ballots: ballots.map((ballot) => ({
            participantId: ballot.participantId,
            membershipId: ballot.participant.membershipId,
            author: ballot.participant.membership.user.displayName,
            scores: ballot.scores,
        })),
    };
}

async function readFrozenScores(
    tx: Prisma.TransactionClient,
    session: Prisma.SessionGetPayload<object>,
): Promise<IScoreSource> {
    const { inputs } = selectionScoresSnapshotSchema.parse(session.selectionResult);
    const participants = await tx.sessionParticipant.findMany({
        where: {
            sessionId: session.id,
            id: { in: inputs.ballots.map((row) => row.participantId) },
        },
        select: {
            id: true,
            membershipId: true,
            membership: { select: { user: { select: { displayName: true } } } },
        },
    });
    const byId = new Map(participants.map((participant) => [participant.id, participant]));
    return {
        films: inputs.nominations.map(({ id, movieId }) => ({ nominationId: id, movieId })),
        ballots: inputs.ballots.map((ballot) => {
            const participant = byId.get(ballot.participantId)!;
            return {
                participantId: participant.id,
                membershipId: participant.membershipId,
                author: participant.membership.user.displayName,
                scores: ballot.scores,
            };
        }),
    };
}

async function readPastScores(
    tx: Prisma.TransactionClient,
    sessionId: string,
): Promise<IScoreSource> {
    const [nominations, participants] = await Promise.all([
        tx.pastNomination.findMany({
            where: { sessionId },
            orderBy: { movieId: 'asc' },
            select: { id: true, movieId: true },
        }),
        tx.sessionParticipant.findMany({
            where: { sessionId, pastSelectionScores: { some: {} } },
            orderBy: { id: 'asc' },
            select: {
                id: true,
                membershipId: true,
                membership: { select: { user: { select: { displayName: true } } } },
                pastSelectionScores: { select: { nominationId: true, score: true } },
            },
        }),
    ]);
    return {
        films: nominations.map(({ id, movieId }) => ({ nominationId: id, movieId })),
        ballots: participants.map((participant) => ({
            participantId: participant.id,
            membershipId: participant.membershipId,
            author: participant.membership.user.displayName,
            scores: participant.pastSelectionScores,
        })),
    };
}
