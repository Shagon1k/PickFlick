'use client';

import type { TPersonalMovieRating } from '@pickflick/contracts';
import { useId, useRef, useState, useTransition } from 'react';

import Button from '#components/ui/Button/Button';
import Icon from '#components/ui/Icon/Icon';
import Popover from '#components/ui/Popover/Popover';
import RatingControl from '#components/ui/ScaleControl/RatingControl';
import { getOfflineMessage } from '#lib/offline';

import { savePersonalRatingAction } from '../../actions';
import styles from './PersonalRating.module.scss';

export default function PersonalRating({
    movieId,
    rating,
}: {
    movieId: string;
    rating: TPersonalMovieRating | null;
}) {
    const id = useId();
    const feedbackRef = useRef<HTMLParagraphElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [score, setScore] = useState(rating?.score);
    const [message, setMessage] = useState('');
    const [isPending, startTransition] = useTransition();

    function handleSave(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        const offline = getOfflineMessage();
        if (offline) {
            setMessage(offline);
            return;
        }
        setMessage('Saving your rating…');
        startTransition(async () => {
            const result = await savePersonalRatingAction(movieId, { score }).catch(() => ({
                ok: false as const,
                message: 'We could not reach PickFlick. Your selection is still here; try again.',
            }));
            setMessage(result.ok ? 'Personal Rating saved.' : result.message);
            feedbackRef.current?.focus();
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
                            ? `Your rating: ${rating.score} out of 10. Edit rating`
                            : 'Rate this film'
                    }
                    onClick={() => setIsOpen(!isOpen)}
                >
                    <Icon name="ratings" />
                    {rating ? `${rating.score}/10` : 'Rate'}
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
                <p>{score === undefined ? 'Choose a rating' : `${score}/10`}</p>
                <p>Your current opinion. Session and Club history stay unchanged.</p>
                <Button type="submit" loading={isPending}>
                    Save rating
                </Button>
                <p role="status" ref={feedbackRef} tabIndex={-1}>
                    {message}
                </p>
            </form>
        </Popover>
    );
}
