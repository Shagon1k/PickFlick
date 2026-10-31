'use client';

import { formatRatingScore, type TRating } from '@pickflick/contracts';
import { useId, useRef, useState } from 'react';

import Icon from '#components/ui/Icon/Icon';
import Popover from '#components/ui/Popover/Popover';
import { getMonogram } from '#lib/format';

import styles from './Rating.module.scss';
import RatingForm from './RatingForm';

type TEntry = Pick<NonNullable<TRating['results']>['entries'][number], 'score' | 'comment'> & {
    id: string;
    author: string;
    isOwn: boolean;
};

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
    const isRating = !data.own && data.canSubmit;
    return (
        <section
            className={styles.rating}
            data-completed={isCompleted || undefined}
            aria-labelledby="rating-heading"
        >
            <h2 id="rating-heading" ref={headingRef} tabIndex={-1}>
                {isRating || (!data.own && !isCompleted) ? 'Your rating' : 'Ratings'}
            </h2>
            {isRating ? (
                <RatingForm sessionId={sessionId} onSaved={() => headingRef.current?.focus()} />
            ) : null}
            {!data.own && !data.canSubmit && !isCompleted ? <p>Join the Session to rate.</p> : null}
            {isImported ? (
                <p>
                    Imported historical ratings. Original submission times are unknown; missing
                    ratings remain unrecorded.
                </p>
            ) : null}
            <RatingList data={data} />
        </section>
    );
}

/** Your response sits highlighted at the top of everyone else's, so nothing is shown twice. */
function RatingList({ data }: { data: TRating }) {
    const entries: TEntry[] = data.results
        ? data.results.entries.toSorted((a, b) => Number(b.isOwn) - Number(a.isOwn))
        : [];
    if (data.own && !entries.some((entry) => entry.isOwn))
        entries.unshift({ id: 'own', author: 'You', isOwn: true, ...data.own });
    if (!entries.length)
        return data.results ? <p className={styles.empty}>No ratings were received.</p> : null;
    return (
        <ul className={styles.list} aria-label="Session ratings">
            {entries.map((entry) => (
                <RatingEntry key={entry.id} entry={entry} />
            ))}
        </ul>
    );
}

function RatingEntry({ entry }: { entry: TEntry }) {
    const name = entry.isOwn ? 'You' : entry.author;
    return (
        <li data-own={entry.isOwn || undefined}>
            <span className={styles.avatar} aria-hidden="true">
                {getMonogram(entry.author)}
            </span>
            <div className={styles.who}>
                <strong>
                    {name}
                    {entry.isOwn ? (
                        <span className={styles.lock}>
                            <Icon name="lock" />
                            Final
                        </span>
                    ) : null}
                </strong>
                {entry.comment ? <Review author={name} comment={entry.comment} /> : null}
            </div>
            <span className={styles.score}>{formatRatingScore(entry.score)}</span>
        </li>
    );
}

/** One line in the list; the whole review opens in a popover next to it. */
function Review({ author, comment }: { author: string; comment: string }) {
    const id = useId();
    const [isOpen, setIsOpen] = useState(false);
    return (
        <Popover
            id={id}
            label={`Review by ${author}`}
            open={isOpen}
            onChange={setIsOpen}
            variant="rating"
            trigger={
                <button
                    aria-label={`Read the review by ${author}`}
                    className={styles.review}
                    onClick={() => setIsOpen(!isOpen)}
                    type="button"
                >
                    {comment}
                </button>
            }
        >
            <p className={styles.fullReview}>{comment}</p>
        </Popover>
    );
}
