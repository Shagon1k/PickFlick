import type { TLiveSelectionOutcome, TSelectionReason } from '@pickflick/contracts';

import { formatCount } from '#lib/format';

const SELECTION_REASONS: Record<TSelectionReason, string> = {
    TOTAL: 'Highest total score',
    MAXIMUM_COUNT: 'Tie resolved by more maximum scores',
    SUPPORTER_COUNT: 'Tie resolved by more supporting voters',
    NOMINATION_TIME: 'Tie resolved by earlier nomination',
    PROVIDER_ID: 'Tie resolved by lower Movie provider ID',
    NOMINATION_ID: 'Tie resolved by lower nomination ID',
    ONLY_NOMINATION: 'Only eligible nomination',
};

export const HIDDEN_BREAKDOWN_COPY =
    'Vote breakdowns are hidden by this Club’s plan or Session visibility settings.';

/** Ballots, scale and the deciding rule, shared by the live result and the Completed record. */
export default function SelectionSummary({
    breakdown,
}: {
    breakdown: NonNullable<TLiveSelectionOutcome['breakdown']>;
}) {
    return (
        <>
            <p>
                {formatCount(breakdown.ballotCount, 'ballot')} received · Scale {breakdown.scaleMin}
                –{breakdown.scaleMax}.
            </p>
            <p>{SELECTION_REASONS[breakdown.reason]}.</p>
            {breakdown.ballotCount === 0 ? (
                <p>
                    No ballots were received. All totals are zero; the tie-break rules chose the
                    winner.
                </p>
            ) : null}
        </>
    );
}
