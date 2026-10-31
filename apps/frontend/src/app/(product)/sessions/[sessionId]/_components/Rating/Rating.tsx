'use client';

import { formatRatingScore, RATING_SCALE, type TRating } from '@pickflick/contracts';
import { useRef } from 'react';

import { getMonogram } from '#lib/format';

import styles from './Rating.module.scss';
import RatingForm from './RatingForm';

export default function Rating({
    sessionId,
    data,
    isCompleted,
    isImported = false,
}: {
    sessionId: string;
    data: TRating;
    isCompleted: boolean;
    isImported?: boolean;
}) {
    const headingRef = useRef<HTMLHeadingElement>(null);
    function renderOwnRating() {
        // A saved rating is final, so it wins over a still-open form.
        if (data.own)
            return (
                <div className={styles.saved} role="status">
                    <p>Your rating is saved</p>
                    <strong>{formatRatingScore(data.own.score)}</strong>
                    {data.own.comment ? <p className={styles.comment}>{data.own.comment}</p> : null}
                    <p>This screening response is final.</p>
                </div>
            );
        if (data.canSubmit)
            return <RatingForm sessionId={sessionId} onSaved={() => headingRef.current?.focus()} />;
        return isCompleted ? null : <p>Join the Session to rate.</p>;
    }
    return (
        <section
            className={styles.rating}
            data-completed={isCompleted || undefined}
            aria-labelledby="rating-heading"
        >
            <h2 id="rating-heading" ref={headingRef} tabIndex={-1}>
                {data.own || data.canSubmit || !isCompleted ? 'Your rating' : 'Ratings'}
            </h2>
            {renderOwnRating()}
            {isImported ? (
                <p>
                    Imported historical ratings. Original submission times are unknown; missing
                    ratings remain unrecorded.
                </p>
            ) : null}
            {data.results ? (
                <div className={styles.results}>
                    <h3>Individual Ratings</h3>
                    {data.results.entries.length ? (
                        <ul>
                            {data.results.entries.map((rating) => (
                                <RatingEntry key={rating.id} rating={rating} />
                            ))}
                        </ul>
                    ) : (
                        <p>No ratings were received.</p>
                    )}
                </div>
            ) : null}
        </section>
    );
}

function RatingEntry({ rating }: { rating: NonNullable<TRating['results']>['entries'][number] }) {
    return (
        <li>
            <div>
                <span className={styles.avatar} aria-hidden="true">
                    {getMonogram(rating.author)}
                </span>
                <span>{rating.author}</span>
                <span className={styles.bars} aria-hidden="true">
                    {Array.from({ length: RATING_SCALE.max }, (_, index) => (
                        <i key={index} data-filled={index < rating.score || undefined} />
                    ))}
                </span>
                <strong>{formatRatingScore(rating.score)}</strong>
            </div>
            {rating.comment ? <p className={styles.comment}>{rating.comment}</p> : null}
        </li>
    );
}
