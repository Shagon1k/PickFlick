'use client';

import { useForm } from '@mantine/form';
import { SESSION_RATING_COMMENT_MAX_LENGTH, submitRatingSchema } from '@pickflick/contracts';
import { useState, useTransition } from 'react';

import Button from '#components/ui/Button/Button';
import RatingControl from '#components/ui/ScaleControl/RatingControl';
import Textarea from '#components/ui/Textarea/Textarea';
import { focusFirstInvalid, toFieldErrors } from '#lib/form-errors';
import { getOfflineMessage } from '#lib/offline';

import { submitRatingAction } from '../../rating-actions';

export default function RatingForm({
    sessionId,
    onSaved,
}: {
    sessionId: string;
    onSaved: () => void;
}) {
    const [message, setMessage] = useState('');
    const [isPending, startTransition] = useTransition();
    const form = useForm<{ score: number | undefined; comment: string }>({
        initialValues: { score: undefined, comment: '' },
        validate: (values) => {
            const parsed = submitRatingSchema.safeParse(values);
            return parsed.success
                ? {}
                : toFieldErrors(parsed.error, {
                      score: 'Choose a rating from 1 to 10.',
                      comment: 'Use plain text up to 2000 characters.',
                  });
        },
    });
    function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
        form.onSubmit(
            (values) => {
                const offline = getOfflineMessage();
                if (offline) {
                    setMessage(offline);
                    return;
                }
                setMessage('Saving your rating…');
                startTransition(async () => {
                    const result = await submitRatingAction(sessionId, values).catch(() => ({
                        ok: false,
                        message:
                            'We could not reach PickFlick. Your input is still here; try again.',
                    }));
                    setMessage(result.ok ? 'Rating submitted.' : result.message);
                    if (result.ok) onSaved();
                });
            },
            (_errors, _values, event) => {
                if (form.values.score !== undefined) {
                    setMessage('Check your comment before submitting.');
                    focusFirstInvalid(event?.currentTarget);
                    return;
                }
                setMessage('Choose a rating from 1 to 10.');
                event?.currentTarget
                    .querySelector<HTMLButtonElement>('[role="radio"][tabindex="0"]')
                    ?.focus();
            },
        )(event);
    }
    return (
        <>
            <form onSubmit={handleSubmit} noValidate>
                <RatingControl
                    name="session-rating"
                    label="Rate this screening"
                    value={form.values.score}
                    onChange={(score) => {
                        form.setFieldValue('score', score);
                        setMessage('');
                    }}
                    disabled={isPending}
                    required
                />
                <Textarea
                    id="session-rating-comment"
                    label="Comment"
                    labelHint="optional"
                    maxLength={SESSION_RATING_COMMENT_MAX_LENGTH}
                    showCount
                    disabled={isPending}
                    {...form.getInputProps('comment')}
                />
                <p>Submit once. Your Session Rating cannot be changed.</p>
                <Button type="submit" loading={isPending}>
                    Submit Rating
                </Button>
            </form>
            <p role="status">{message}</p>
        </>
    );
}
