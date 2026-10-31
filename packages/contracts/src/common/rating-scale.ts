import { z } from 'zod';

/** Session and Personal Ratings use one 1–10 scale; Selection scores have their own Club scale. */
export const RATING_SCALE = { min: 1, max: 10 } as const;

export const ratingScoreSchema = z.int().min(RATING_SCALE.min).max(RATING_SCALE.max);

export const RATING_SCORES = Array.from(
    { length: RATING_SCALE.max - RATING_SCALE.min + 1 },
    (_, index) => RATING_SCALE.min + index,
);

export function formatRatingScore(score: number) {
    return `${score}/${RATING_SCALE.max}`;
}
