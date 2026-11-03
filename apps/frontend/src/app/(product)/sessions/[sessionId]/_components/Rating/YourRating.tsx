'use client';

import { formatRatingScore, type TRating } from '@pickflick/contracts';
import { useRef } from 'react';

import Skeleton from '#components/ui/Skeleton/Skeleton';

import RatingForm, { RatingFormSkeleton } from './RatingForm';
import styles from './YourRating.module.scss';

/** The prototype's personal submission card stays in place throughout the Rating phase. */
export default function YourRating({
    sessionId,
    data,
    isLoading = false,
}: {
    sessionId: string;
    data: TRating;
    isLoading?: boolean;
}) {
    const headingRef = useRef<HTMLHeadingElement>(null);
    if (!data.own && !data.canSubmit) return null;
    return (
        <section className={styles.card} aria-labelledby="your-rating-heading">
            <h2 id="your-rating-heading" ref={headingRef} tabIndex={-1}>
                Your rating
            </h2>
            {data.own ? (
                <div className={styles.saved}>
                    <strong className={isLoading ? styles.savedValue : undefined}>
                        {isLoading ? <Skeleton shouldFill /> : formatRatingScore(data.own.score)}
                    </strong>
                    <span>Saved</span>
                </div>
            ) : isLoading ? (
                <RatingFormSkeleton />
            ) : (
                <RatingForm sessionId={sessionId} onSaved={() => headingRef.current?.focus()} />
            )}
        </section>
    );
}
