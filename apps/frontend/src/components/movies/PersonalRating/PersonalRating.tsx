'use client';

import { formatRatingScore, RATING_SCALE, type TPersonalMovieRating } from '@pickflick/contracts';
import { useId, useRef, useState } from 'react';

import Button from '#components/ui/Button/Button';
import Icon from '#components/ui/Icon/Icon';
import Popover from '#components/ui/Popover/Popover';
import RatingControl from '#components/ui/ScaleControl/RatingControl';
import { useActionStatus } from '#lib/use-action-status';

import { savePersonalRatingAction } from './actions';
import styles from './PersonalRating.module.scss';

export default function PersonalRating({
    movieId,
    rating,
    onSaved,
}: {
    movieId: string;
    rating: TPersonalMovieRating | null;
    onSaved?: (message: string) => void;
}) {
    const id = useId();
    const feedbackRef = useRef<HTMLParagraphElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [score, setScore] = useState(rating?.score);
    const { message, isSuccess, setMessage, announceSuccess, isPending, run } = useActionStatus();

    function handleSave(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        run(() => savePersonalRatingAction(movieId, { score }), {
            pendingMessage: 'Saving your rating…',
            unreachableMessage:
                'We could not reach PickFlick. Your selection is still here; try again.',
            onResult: (result) => {
                if (result.ok) announceSuccess('Personal Rating saved.');
                else setMessage(result.message);
                feedbackRef.current?.focus();
                if (result.ok && onSaved) {
                    setIsOpen(false);
                    onSaved('Personal Rating saved.');
                }
            },
        });
    }

    return (
        <Popover
            id={id}
            label="Your rating"
            variant="rating"
            open={isOpen}
            onChange={setIsOpen}
            trigger={
                <Button
                    variant="cell"
                    aria-label={
                        rating
                            ? `Your rating: ${rating.score} out of ${RATING_SCALE.max}. Edit rating`
                            : 'Rate this film'
                    }
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <Icon name="ratings" />
                    {rating ? formatRatingScore(rating.score) : 'Rate'}
                </Button>
            }
        >
            <form className={styles.personalRating} onSubmit={handleSave}>
                <RatingControl
                    name="personal-rating"
                    label="Your rating"
                    value={score}
                    onChange={(value) => {
                        setScore(value);
                        setMessage('');
                    }}
                    disabled={isPending}
                    required
                />
                <p>{score === undefined ? 'Choose a rating' : formatRatingScore(score)}</p>
                <p>Your current opinion. Session and Club history stay unchanged.</p>
                <Button type="submit" loading={isPending}>
                    Save rating
                </Button>
                <p
                    className={isSuccess ? 'visually-hidden' : undefined}
                    role="status"
                    ref={feedbackRef}
                    tabIndex={-1}
                >
                    {message}
                </p>
            </form>
        </Popover>
    );
}
