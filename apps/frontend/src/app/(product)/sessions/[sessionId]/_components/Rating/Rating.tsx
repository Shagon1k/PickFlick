'use client';

import type { TRating } from '@pickflick/contracts';
import { useRef } from 'react';

import styles from './Rating.module.scss';
import RatingForm from './RatingForm';

export default function Rating({
    sessionId,
    data,
    isCompleted,
}: {
    sessionId: string;
    data: TRating;
    isCompleted: boolean;
}) {
    const headingRef = useRef<HTMLHeadingElement>(null);
    const unavailable = isCompleted
        ? 'This Session is complete. No more ratings can be added.'
        : 'Join this Session in an active Club to submit a rating.';
    let response = <p>{unavailable}</p>;
    if (data.canSubmit)
        response = <RatingForm sessionId={sessionId} onSaved={() => headingRef.current?.focus()} />;
    if (data.own)
        response = (
            <div className={styles.saved} role="status">
                <p>Your rating is saved</p>
                <strong>{data.own.score}/10</strong>
                {data.own.comment ? <p className={styles.comment}>{data.own.comment}</p> : null}
                <p>This screening response is final.</p>
            </div>
        );
    return (
        <section className={styles.rating} aria-labelledby="rating-heading">
            <h2 id="rating-heading" ref={headingRef} tabIndex={-1}>
                Your rating
            </h2>
            {response}
            {data.results ? (
                <div className={styles.results}>
                    <h3>Individual Ratings</h3>
                    {data.results.entries.length ? (
                        <ul>
                            {data.results.entries.map((rating) => (
                                <li key={rating.id}>
                                    <div>
                                        <span>{rating.author}</span>
                                        <strong>{rating.score}/10</strong>
                                    </div>
                                    {rating.comment ? (
                                        <p className={styles.comment}>{rating.comment}</p>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>No ratings were received.</p>
                    )}
                </div>
            ) : (
                <p>
                    {isCompleted
                        ? 'Club rating results are hidden by this Session’s visibility setting.'
                        : 'Club rating results are available after completion, when permitted.'}
                </p>
            )}
        </section>
    );
}
