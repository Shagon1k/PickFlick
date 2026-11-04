'use client';

import { RATING_SCALE, type TRating } from '@pickflick/contracts';
import { useId, useState } from 'react';

import Avatar from '#components/ui/Avatar/Avatar';
import ColorReveal from '#components/ui/ColorReveal/ColorReveal';
import Icon from '#components/ui/Icon/Icon';
import Popover from '#components/ui/Popover/Popover';
import Skeleton from '#components/ui/Skeleton/Skeleton';

import styles from './Rating.module.scss';

type TEntry = Pick<
    NonNullable<NonNullable<TRating['results']>['entries']>[number],
    'id' | 'score' | 'comment' | 'author' | 'avatarUrl' | 'isOwn'
>;

export default function Rating({
    data,
    isInProgress = false,
    isLoading = false,
}: {
    data: TRating;
    isInProgress?: boolean;
    isLoading?: boolean;
}) {
    return (
        <section className={styles.rating} aria-labelledby="rating-heading">
            <h2 id="rating-heading" tabIndex={-1}>
                Ratings
            </h2>
            <RatingList data={data} isInProgress={isInProgress} isLoading={isLoading} />
        </section>
    );
}

/** Your response appears first, without duplicating it among everyone else's. */
function RatingList({
    data,
    isInProgress,
    isLoading,
}: {
    data: TRating;
    isInProgress: boolean;
    isLoading: boolean;
}) {
    const entries: TEntry[] =
        data.results?.entries?.toSorted((a, b) => Number(b.isOwn) - Number(a.isOwn)) ?? [];
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
        return data.results?.entries ? (
            <p className={styles.empty}>No ratings were received.</p>
        ) : null;
    return (
        <ul className={styles.list} aria-label="Session ratings">
            {entries.map((entry) => (
                <RatingEntry key={entry.id} entry={entry} isLoading={isLoading} />
            ))}
        </ul>
    );
}

function RatingEntry({ entry, isLoading }: { entry: TEntry; isLoading: boolean }) {
    const name = entry.isOwn ? 'You' : entry.author;
    const formattedScore =
        entry.score === RATING_SCALE.max ? String(entry.score) : entry.score.toFixed(1);
    return (
        <li data-own={entry.isOwn || undefined} data-color-reveal-trigger data-color-reveal-surface>
            <ColorReveal variant="surface" />
            <Avatar
                name={entry.author}
                src={entry.avatarUrl}
                size="extra-large"
                isLoading={isLoading}
            />
            <div className={styles.who}>
                <strong>{isLoading ? <Skeleton text={name} /> : name}</strong>
                {entry.comment ? (
                    <Review author={name} comment={entry.comment} isLoading={isLoading} />
                ) : null}
            </div>
            <span className={styles.score}>
                {isLoading ? (
                    <Skeleton text={formattedScore} />
                ) : (
                    <ColorReveal variant="accent">{formattedScore}</ColorReveal>
                )}
            </span>
        </li>
    );
}

/** One line in the list; the whole review opens in a popover next to it. */
function Review({
    author,
    comment,
    isLoading,
}: {
    author: string;
    comment: string;
    isLoading: boolean;
}) {
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
                    disabled={isLoading}
                    data-open={isOpen || undefined}
                    onClick={() => setIsOpen(!isOpen)}
                    type="button"
                >
                    <span className={styles.reviewText}>
                        {isLoading ? <Skeleton text={comment} /> : comment}
                    </span>
                    <Icon name="chevron-down" />
                </button>
            }
        >
            <p className={styles.fullReview}>{comment}</p>
        </Popover>
    );
}
