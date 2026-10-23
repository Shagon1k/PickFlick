import type { TSelectionReason } from '@pickflick/contracts';

export const SELECTION_REASONS: Record<TSelectionReason, string> = {
    TOTAL: 'Highest total score',
    MAXIMUM_COUNT: 'Tie resolved by more maximum scores',
    SUPPORTER_COUNT: 'Tie resolved by more supporting voters',
    NOMINATION_TIME: 'Tie resolved by earlier nomination',
    PROVIDER_ID: 'Tie resolved by lower Movie provider ID',
    NOMINATION_ID: 'Tie resolved by lower nomination ID',
    ONLY_NOMINATION: 'Only eligible nomination',
};
