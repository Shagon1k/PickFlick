import type { TSessionPhase } from '@pickflick/contracts';

import nominationPanda from '#brand/panda-collection.webp';
import watchingPanda from '#brand/panda-rating.webp';
import selectionPanda from '#brand/panda-rating-2.webp';

export function getPhaseMascot(phase: TSessionPhase) {
    if (phase === 'NOMINATION') return nominationPanda;
    if (phase === 'SELECTION') return selectionPanda;
    return watchingPanda;
}
