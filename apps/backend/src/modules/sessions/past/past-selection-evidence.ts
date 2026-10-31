import { ConflictException } from '@nestjs/common';
import type { TCreatePastSession } from '@pickflick/contracts';
import type { Prisma } from '@pickflick/database';

export function assertPastSelectionRange(
    matrix: TCreatePastSession['scoreMatrix'],
    settings: { selectionScaleMin: number; selectionScaleMax: number },
) {
    if (
        matrix
            .flatMap((row) => row.scores)
            .some(
                (cell) =>
                    cell.score < settings.selectionScaleMin ||
                    cell.score > settings.selectionScaleMax,
            )
    )
        throw new ConflictException({ reason: 'SCORE_OUT_OF_RANGE' });
}

export async function assertPastNominators(
    tx: Prisma.TransactionClient,
    clubId: string,
    nominations: TCreatePastSession['nominations'],
) {
    const ids = [
        ...new Set(
            nominations.map((row) => row.nominatorMembershipId).filter((id) => id !== undefined),
        ),
    ];
    if ((await tx.membership.count({ where: { clubId, id: { in: ids } } })) !== ids.length)
        throw new ConflictException({ reason: 'NOMINATOR_UNAVAILABLE' });
}

export async function createPastSelection(
    tx: Prisma.TransactionClient,
    sessionId: string,
    input: TCreatePastSession,
) {
    const participants = await tx.sessionParticipant.findMany({ where: { sessionId } });
    const participantIds = new Map(participants.map((row) => [row.membershipId, row.id]));
    for (const { movieId, nominatorMembershipId } of input.nominations) {
        await tx.pastNomination.create({
            data: {
                sessionId,
                movieId,
                nominatorMembershipId,
                scores: {
                    create: input.scoreMatrix.flatMap((row) =>
                        row.scores
                            .filter((cell) => cell.movieId === movieId)
                            .map((cell) => ({
                                participantId: participantIds.get(row.membershipId)!,
                                score: cell.score,
                            })),
                    ),
                },
            },
        });
    }
}
