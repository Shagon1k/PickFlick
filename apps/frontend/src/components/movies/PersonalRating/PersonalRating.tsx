'use client';

import { RATING_SCALE, type TPersonalMovieRating } from '@pickflick/contracts';
import { useEffect, useId, useRef, useState } from 'react';

import Button from '#components/ui/Button/Button';
import Icon from '#components/ui/Icon/Icon';
import Popover from '#components/ui/Popover/Popover';
import RatingControl from '#components/ui/ScaleControl/RatingControl';
import { useActionStatus } from '#lib/use-action-status';

import { savePersonalRatingAction } from './actions';
import styles from './PersonalRating.module.scss';

// Arrow keys step through several stars; only the one the viewer settles on is saved.
const SAVE_DELAY_MS = 400;

/** The prototype's compact rating: a pill in the film ticket and a row of stars that saves itself. */
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
    const [isOpen, setIsOpen] = useState(false);
    const [score, setScore] = useState(rating?.score);
    const saveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
    const { message, isSuccess, setMessage, announceSuccess, run } = useActionStatus();
    useEffect(() => () => clearTimeout(saveTimerRef.current), []);

    function save(value: number) {
        run(() => savePersonalRatingAction(movieId, { score: value }), {
            pendingMessage: 'Saving…',
            unreachableMessage: 'We could not reach PickFlick. Choose your rating again to retry.',
            onResult: (result) => {
                if (!result.ok) return setMessage(result.message);
                announceSuccess('Personal Rating saved.');
                if (onSaved) {
                    setIsOpen(false);
                    onSaved('Personal Rating saved.');
                }
            },
        });
    }

    function handleChange(value: number) {
        setScore(value);
        setMessage('');
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => save(value), SAVE_DELAY_MS);
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
                    {rating ? (
                        <span className={styles.pill}>
                            <strong>{rating.score}</strong>
                            <small>You</small>
                        </span>
                    ) : (
                        'Rate'
                    )}
                </Button>
            }
        >
            <div className={styles.personalRating}>
                <p aria-hidden="true" className={styles.label}>
                    {score === undefined ? 'Rate' : `${score}/${RATING_SCALE.max}`}
                </p>
                <RatingControl
                    isCompact
                    name="personal-rating"
                    label="Your rating"
                    value={score}
                    onChange={handleChange}
                />
                <p className={isSuccess ? 'visually-hidden' : styles.status} role="status">
                    {message}
                </p>
            </div>
        </Popover>
    );
}
