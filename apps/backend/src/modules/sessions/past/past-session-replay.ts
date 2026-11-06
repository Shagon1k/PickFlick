import { ConflictException } from '@nestjs/common';
import type { TCreatePastSession } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

interface IPastEvidence {
    details: unknown[];
    attendees: unknown[][];
    nominations: unknown[][];
    scores: unknown[][];
}

/**
 * A retried form must carry the evidence already saved: edits made after a lost response are
 * reported as `SUBMISSION_MISMATCH`, never silently dropped. Row order does not matter.
 */
export async function assertSameSubmission(
    tx: Prisma.TransactionClient,
    sessionId: string,
    input: TCreatePastSession,
) {
    const saved = await tx.session.findUniqueOrThrow({
        where: { id: sessionId },
        select: {
            scheduledAt: true,
            location: true,
            movieId: true,
            topic: true,
            notes: true,
            participants: { select: { membershipId: true, rating: { select: { score: true } } } },
            pastNominations: {
                select: {
                    movieId: true,
                    nominatorMembershipId: true,
                    scores: {
                        select: { score: true, participant: { select: { membershipId: true } } },
                    },
                },
            },
        },
    });
    const savedEvidence: IPastEvidence = {
        details: [
            saved.scheduledAt?.getTime(),
            saved.location,
            saved.movieId,
            saved.topic,
            saved.notes,
        ],
        attendees: saved.participants.map((row) => [row.membershipId, row.rating?.score]),
        nominations: saved.pastNominations.map((row) => [row.movieId, row.nominatorMembershipId]),
        scores: saved.pastNominations.flatMap((nomination) =>
            nomination.scores.map((cell) => [
                cell.participant.membershipId,
                nomination.movieId,
                cell.score,
            ]),
        ),
    };
    const submittedEvidence: IPastEvidence = {
        details: [
            new Date(input.scheduledAt).getTime(),
            input.location,
            input.movieId,
            input.topic,
            input.notes,
        ],
        attendees: input.attendees.map((row) => [row.membershipId, row.score]),
        nominations: input.nominations.map((row) => [row.movieId, row.nominatorMembershipId]),
        scores: input.scoreMatrix.flatMap((row) =>
            row.scores.map((cell) => [row.membershipId, cell.movieId, cell.score]),
        ),
    };
    if (fingerprint(savedEvidence) !== fingerprint(submittedEvidence))
        throw new ConflictException({ reason: 'SUBMISSION_MISMATCH' });
}

/** JSON writes a missing optional value and a stored null the same way, as `null`. */
function fingerprint({ details, attendees, nominations, scores }: IPastEvidence) {
    const sortRows = (rows: unknown[][]) =>
        rows.map((row) => JSON.stringify(row)).toSorted((left, right) => left.localeCompare(right));
    return JSON.stringify([details, sortRows(attendees), sortRows(nominations), sortRows(scores)]);
}
