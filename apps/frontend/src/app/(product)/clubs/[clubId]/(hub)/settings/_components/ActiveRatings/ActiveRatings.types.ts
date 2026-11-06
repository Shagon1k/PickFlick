import type { TRatingCloseData } from '#components/sessions/RatingClose/RatingClose';

export type TRatingCloseControl =
    | { sessionId: string; status: 'ready'; phaseVersion: number; rating: TRatingCloseData }
    | { sessionId: string; status: 'unavailable' };
