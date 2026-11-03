'use client';

import { formatRatingScore, type TRating } from '@pickflick/contracts';
import { useId, useState } from 'react';

import Avatar from '#components/ui/Avatar/Avatar';
import ColorReveal from '#components/ui/ColorReveal/ColorReveal';
import Icon from '#components/ui/Icon/Icon';
import Popover from '#components/ui/Popover/Popover';

import styles from './Rating.module.scss';

type TEntry = Pick<
    NonNullable<TRating['results']>['entries'][number],
    'id' | 'score' | 'comment' | 'author' | 'avatarUrl' | 'isOwn'
>;

export default function Rating({
    data,
    isInProgress = false,
}: {
    data: TRating;
    isInProgress?: boolean;
}) {
    return (
        <section className={styles.rating} aria-labelledby="rating-heading">
            <h2 id="rating-heading" tabIndex={-1}>
                Ratings
            </h2>
            <RatingList data={data} isInProgress={isInProgress} />
        </section>
    );
}

/** Your response appears first, without duplicating it among everyone else's. */
function RatingList({ data, isInProgress }: { data: TRating; isInProgress: boolean }) {
    const entries: TEntry[] = data.results
        ? data.results.entries.toSorted((a, b) => Number(b.isOwn) - Number(a.isOwn))
        : [];
    if (data.own && !entries.some((entry) => entry.isOwn))
        entries.unshift({ id: 'own', isOwn: true, ...data.own });
    if (!entries.length && isInProgress)
        return (
            <div className={styles.inProgress}>
                <span aria-hidden="true">—</span>
                <p>In progress</p>
            </div>
        );
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
        <li data-own={entry.isOwn || undefined} data-color-reveal-trigger data-color-reveal-surface>
            <ColorReveal variant="surface" />
            <Avatar name={entry.author} src={entry.avatarUrl} size="extra-large" />
            <div className={styles.who}>
                <strong>{name}</strong>
                {entry.comment ? <Review author={name} comment={entry.comment} /> : null}
            </div>
            <span className={styles.score}>
                <ColorReveal variant="accent">{formatRatingScore(entry.score)}</ColorReveal>
            </span>
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
            variant="review"
            trigger={
                <button
                    aria-label={`Read the review by ${author}`}
                    className={styles.review}
                    data-open={isOpen || undefined}
                    onClick={() => setIsOpen(!isOpen)}
                    type="button"
                >
                    <span className={styles.reviewText}>{comment}</span>
                    <Icon name="chevron-down" />
                </button>
            }
        >
            <p className={styles.fullReview}>{comment}</p>
        </Popover>
    );
}
