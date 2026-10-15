import { type ISelectionInputs, resolveSelection } from '../selection-winner.js';

const NOMINATED_AT = '2026-10-14T12:00:00.000Z';

function createInputs(): ISelectionInputs {
    return {
        scaleMin: 0,
        scaleMax: 5,
        acceptedParticipantIds: ['voter-1', 'voter-2', 'voter-3'],
        nominations: ['a', 'b'].map((id) => ({
            id,
            movieId: `movie-${id}`,
            submittedAt: NOMINATED_AT,
            externalIds: [{ source: 'tmdb', externalId: '10' }],
        })),
        ballots: [],
    };
}

function setScores(inputs: ISelectionInputs, scores: number[][]) {
    inputs.ballots = scores.map((values, index) => ({
        id: `ballot-${index}`,
        participantId: `voter-${index}`,
        submittedAt: NOMINATED_AT,
        scores: values.map((score, nominationIndex) => ({
            nominationId: inputs.nominations[nominationIndex]!.id,
            score,
        })),
    }));
}

describe('resolveSelection', () => {
    it.each([
        {
            reason: 'TOTAL',
            scores: [
                [1, 5],
                [1, 0],
            ],
            winner: 'b',
        },
        {
            reason: 'MAXIMUM_COUNT',
            scores: [
                [5, 3],
                [0, 2],
            ],
            winner: 'a',
        },
        {
            reason: 'SUPPORTER_COUNT',
            scores: [
                [4, 2],
                [0, 2],
            ],
            winner: 'b',
        },
        { reason: 'NOMINATION_ID', scores: [[0, 0]], winner: 'a' },
    ])('should resolve $reason before later tie-breaks', ({ reason, scores, winner }) => {
        const inputs = createInputs();
        setScores(inputs, scores);
        const original = structuredClone(inputs);
        for (const nominations of [inputs.nominations, inputs.nominations.toReversed()]) {
            const result = resolveSelection({ ...inputs, nominations });
            expect(result).toMatchObject({ winnerNominationId: winner, reason });
        }
        expect(inputs).toEqual(original);
    });

    it.each([
        { change: 'time', reason: 'NOMINATION_TIME' },
        { change: 'numeric provider', reason: 'PROVIDER_ID' },
        { change: 'text provider', reason: 'PROVIDER_ID' },
        { change: 'missing provider', reason: 'PROVIDER_ID' },
        { change: 'provider source', reason: 'PROVIDER_ID' },
        { change: 'no ballots', reason: 'NOMINATION_ID' },
    ])('should resolve $change deterministically with no ballots', ({ change, reason }) => {
        const inputs = createInputs();
        const first = inputs.nominations[0]!;
        const second = inputs.nominations[1]!;
        if (change === 'time') second.submittedAt = '2026-10-13T12:00:00.000Z';
        if (change === 'numeric provider') second.externalIds[0]!.externalId = '2';
        if (change === 'text provider') {
            first.externalIds = [{ source: 'imdb', externalId: 'tt002' }];
            second.externalIds = [{ source: 'imdb', externalId: 'tt001' }];
        }
        if (change === 'missing provider') first.externalIds = [];
        if (change === 'provider source') second.externalIds[0]!.source = 'poiskkino';
        const result = resolveSelection(inputs);
        expect(result).toMatchObject({
            winnerNominationId: change === 'no ballots' ? 'a' : 'b',
            reason,
        });
        expect(result.ranking.every((row) => row.total === 0)).toBe(true);
    });

    it('should count received ballots after departures without changing the films', () => {
        const inputs = createInputs();
        setScores(inputs, [
            [0, 5],
            [1, 0],
        ]);
        inputs.acceptedParticipantIds = [];
        expect(resolveSelection(inputs)).toMatchObject({
            winnerNominationId: 'b',
            reason: 'TOTAL',
        });
    });

    it('should count positive support on a stored 1-based scale and use its maximum', () => {
        const inputs = createInputs();
        inputs.scaleMin = 1;
        inputs.scaleMax = 3;
        setScores(inputs, [
            [3, 2],
            [1, 2],
        ]);
        expect(resolveSelection(inputs)).toMatchObject({
            winnerNominationId: 'a',
            reason: 'MAXIMUM_COUNT',
            ranking: [
                { total: 4, maximumCount: 1, supporterCount: 2 },
                { total: 4, maximumCount: 0, supporterCount: 2 },
            ],
        });
    });

    it('should retain distinct nominations of the same Movie and select one nomination', () => {
        const inputs = createInputs();
        inputs.nominations[1]!.movieId = inputs.nominations[0]!.movieId;
        expect(resolveSelection(inputs)).toMatchObject({
            winnerNominationId: 'a',
            reason: 'NOMINATION_ID',
        });
        expect(resolveSelection(inputs).ranking).toHaveLength(2);
    });

    it('should use the lowest mapping independently of mapping order and integer size', () => {
        const inputs = createInputs();
        inputs.nominations[0]!.externalIds = [
            { source: 'tmdb', externalId: '9007199254740993' },
            { source: 'thetvdb', externalId: '9007199254740993' },
        ];
        inputs.nominations[1]!.externalIds = [
            { source: 'thetvdb', externalId: '9007199254740992' },
        ];
        expect(resolveSelection(inputs)).toMatchObject({
            winnerNominationId: 'b',
            reason: 'PROVIDER_ID',
        });
    });
});
