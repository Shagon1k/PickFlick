'use client';

import { formatRatingScore, type TRating } from '@pickflick/contracts';
import { useRef } from 'react';

import RatingForm from './RatingForm';
import styles from './YourRating.module.scss';

/** The prototype's personal submission card stays in place throughout the Rating phase. */
export default function YourRating({ sessionId, data }: { sessionId: string; data: TRating }) {
    const headingRef = useRef<HTMLHeadingElement>(null);
    if (!data.own && !data.canSubmit) return null;
    return (
        <section className={styles.card} aria-labelledby="your-rating-heading">
            <h2 id="your-rating-heading" ref={headingRef} tabIndex={-1}>
                Your rating
            </h2>
            {data.own ? (
                <div className={styles.saved}>
                    <strong>{formatRatingScore(data.own.score)}</strong>
                    <span>Saved</span>
                </div>
            ) : (
                <RatingForm sessionId={sessionId} onSaved={() => headingRef.current?.focus()} />
            )}
        </section>
    );
}
