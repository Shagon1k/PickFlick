export interface ISelectionInputs {
    scaleMin: number;
    scaleMax: number;
    acceptedParticipantIds: string[];
    nominations: {
        id: string;
        movieId: string;
        submittedAt: string;
        externalIds: { source: string; externalId: string }[];
    }[];
    ballots: {
        id: string;
        participantId: string;
        submittedAt: string;
        scores: { nominationId: string; score: number }[];
    }[];
}

type TProviderId = ISelectionInputs['nominations'][number]['externalIds'][number];

function compareText(a: string, b: string) {
    return a < b ? -1 : Number(a > b);
}

function compareProviderIds(a: TProviderId, b: TProviderId) {
    const sourceOrder = compareText(a.source, b.source);
    if (sourceOrder) return sourceOrder;
    if (/^\d+$/u.test(a.externalId) && /^\d+$/u.test(b.externalId)) {
        const left = BigInt(a.externalId);
        const right = BigInt(b.externalId);
        return left < right ? -1 : Number(left > right);
    }
    return compareText(a.externalId, b.externalId);
}

function compareProviders(a: TProviderId | null, b: TProviderId | null) {
    if (!a) return b ? 1 : 0;
    if (!b) return -1;
    return compareProviderIds(a, b);
}

type TCandidate = ReturnType<typeof buildCandidates>[number];

function buildCandidates(inputs: ISelectionInputs) {
    return inputs.nominations.map((nomination) => {
        const scores = inputs.ballots.flatMap((ballot) =>
            ballot.scores.filter((score) => score.nominationId === nomination.id),
        );
        return {
            ...nomination,
            providerId: nomination.externalIds.toSorted(compareProviderIds)[0] ?? null,
            total: scores.reduce((total, row) => total + row.score, 0),
            maximumCount: scores.filter((row) => row.score === inputs.scaleMax).length,
            supporterCount: scores.filter((row) => row.score > 0).length,
        };
    });
}

function compareCandidates(a: TCandidate, b: TCandidate) {
    const steps = [
        { reason: 'TOTAL', order: b.total - a.total },
        { reason: 'MAXIMUM_COUNT', order: b.maximumCount - a.maximumCount },
        { reason: 'SUPPORTER_COUNT', order: b.supporterCount - a.supporterCount },
        { reason: 'NOMINATION_TIME', order: compareText(a.submittedAt, b.submittedAt) },
        { reason: 'PROVIDER_ID', order: compareProviders(a.providerId, b.providerId) },
        { reason: 'NOMINATION_ID', order: compareText(a.id, b.id) },
    ];
    return steps.find((step) => step.order !== 0) ?? { reason: 'NOMINATION_ID', order: 0 };
}

export function resolveSelection(inputs: ISelectionInputs) {
    const ranking = buildCandidates(inputs).sort((a, b) => compareCandidates(a, b).order);
    const winner = ranking[0]!;
    const runnerUp = ranking[1];
    return {
        winnerNominationId: winner.id,
        movieId: winner.movieId,
        reason: runnerUp ? compareCandidates(winner, runnerUp).reason : 'ONLY_NOMINATION',
        ranking,
    };
}
