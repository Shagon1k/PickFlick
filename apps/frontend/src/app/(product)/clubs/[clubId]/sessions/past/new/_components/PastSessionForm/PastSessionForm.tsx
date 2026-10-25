'use client';

import { useForm } from '@mantine/form';
import {
    createPastSessionSchema,
    SESSION_LOCATION_MAX_LENGTH,
    SESSION_NOTES_MAX_LENGTH,
    SESSION_TOPIC_MAX_LENGTH,
    type TCreatePastSession,
    type TPastSessionMembers,
    type TSession,
} from '@pickflick/contracts';
import { useRef, useState, useSyncExternalStore, useTransition } from 'react';

import MoviePicker from '#components/sessions/MoviePicker/MoviePicker';
import Button from '#components/ui/Button/Button';
import ButtonLink from '#components/ui/Button/ButtonLink';
import RatingControl from '#components/ui/ScaleControl/RatingControl';
import Textarea from '#components/ui/Textarea/Textarea';
import TextInput from '#components/ui/TextInput/TextInput';
import { focusFirstInvalid, toFieldErrors } from '#lib/form-errors';
import { getOfflineMessage } from '#lib/offline';

import { savePastSessionAction } from '../../actions';
import PastNominations from '../PastNominations/PastNominations';
import styles from './PastSessionForm.module.scss';

interface IPastSessionValues {
    date: string;
    location: string;
    topic: string;
    notes: string;
    movieId: string;
    attendees: TCreatePastSession['attendees'];
    nominations: TCreatePastSession['nominations'];
    scoreMatrix: TCreatePastSession['scoreMatrix'];
}

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function PastSessionForm({
    clubId,
    members,
    scaleMin,
    scaleMax,
}: {
    clubId: string;
    members: TPastSessionMembers;
    scaleMin: number;
    scaleMax: number;
}) {
    const [isPending, startTransition] = useTransition();
    // Early input would be lost when React first updates these controlled fields.
    const isReady = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
    const isDisabled = !isReady || isPending;
    const [message, setMessage] = useState('');
    const [created, setCreated] = useState<TSession | null>(null);
    const submissionIdRef = useRef<string | null>(null);
    function buildInput({ date, ...values }: IPastSessionValues) {
        submissionIdRef.current ??= crypto.randomUUID();
        return {
            ...values,
            scheduledAt: date ? `${date}T00:00:00.000Z` : '',
            submissionId: submissionIdRef.current,
        };
    }
    const form = useForm<IPastSessionValues>({
        initialValues: {
            date: '',
            location: '',
            topic: '',
            notes: '',
            movieId: '',
            attendees: [],
            nominations: [],
            scoreMatrix: [],
        },
        validate: (values) => {
            const parsed = createPastSessionSchema.safeParse(buildInput(values));
            if (parsed.success) return {};
            const { scheduledAt, ...errors } = toFieldErrors(parsed.error, {
                scheduledAt: 'Choose a valid date in the past.',
                location: 'Use 1–200 characters on one line.',
                topic: 'Use up to 200 characters on one line.',
                notes: 'Use up to 2000 characters.',
                movieId: 'Select a Movie.',
            });
            return { ...errors, date: scheduledAt };
        },
    });
    function save(values: IPastSessionValues) {
        const offlineMessage = getOfflineMessage();
        if (offlineMessage) {
            setMessage(offlineMessage);
            return;
        }
        setMessage('Logging Session…');
        startTransition(async () => {
            const result = await savePastSessionAction(clubId, buildInput(values)).catch(() => ({
                ok: false as const,
                message: 'We could not reach PickFlick. Your entries are still here; try again.',
            }));
            if (!result.ok) {
                setMessage(result.message);
                return;
            }
            setCreated(result.session);
        });
    }
    if (created)
        return (
            <div className={styles.result}>
                <p role="status">Past Session logged. Only the evidence you supplied was saved.</p>
                <ButtonLink href={`/sessions/${created.id}`} variant="primary">
                    Open Session
                </ButtonLink>
                <ButtonLink href={`/clubs/${clubId}/sessions`}>Back to Club history</ButtonLink>
            </div>
        );
    return (
        <form
            noValidate
            onSubmit={(event) =>
                form.onSubmit(save, (_errors, _values, submitEvent) => {
                    setMessage('Review the highlighted fields and try again.');
                    focusFirstInvalid(submitEvent?.currentTarget);
                })(event)
            }
        >
            <TextInput
                {...form.getInputProps('date')}
                id="past-date"
                label="Date"
                labelHint="required"
                type="date"
                required
                disabled={isDisabled}
            />
            <TextInput
                {...form.getInputProps('location')}
                id="past-location"
                label="Location"
                labelHint="required"
                maxLength={SESSION_LOCATION_MAX_LENGTH}
                placeholder="e.g. Sarah’s place, Zoom, Alamo Drafthouse"
                required
                disabled={isDisabled}
            />
            <TextInput
                {...form.getInputProps('topic')}
                id="past-topic"
                label="Topic"
                labelHint="optional"
                maxLength={SESSION_TOPIC_MAX_LENGTH}
                disabled={isDisabled}
            />
            <Textarea
                {...form.getInputProps('notes')}
                id="past-notes"
                label="Notes"
                labelHint="optional"
                maxLength={SESSION_NOTES_MAX_LENGTH}
                size="compact"
                disabled={isDisabled}
            />
            <MoviePicker
                value={form.values.movieId || null}
                onChange={(id) => form.setFieldValue('movieId', id ?? '')}
                disabled={isDisabled}
                error={form.errors.movieId}
                placeholder="Search films by title…"
            />
            <fieldset className={styles.attendees} disabled={isDisabled}>
                <legend>Who attended?</legend>
                <p>Select only known attendees. Leave unknown ratings blank.</p>
                <div className={styles.members}>
                    {members.map((member) => {
                        const index = form.values.attendees.findIndex(
                            (row) => row.membershipId === member.id,
                        );
                        return (
                            <label key={member.id}>
                                <input
                                    type="checkbox"
                                    checked={index >= 0}
                                    onChange={(event) => {
                                        if (event.currentTarget.checked)
                                            form.insertListItem('attendees', {
                                                membershipId: member.id,
                                            });
                                        else {
                                            form.removeListItem('attendees', index);
                                            form.setFieldValue(
                                                'scoreMatrix',
                                                form.values.scoreMatrix.filter(
                                                    (row) => row.membershipId !== member.id,
                                                ),
                                            );
                                        }
                                    }}
                                />
                                {member.displayName}
                                {member.status !== 'ACTIVE' ? ' (former member)' : ''}
                            </label>
                        );
                    })}
                </div>
                {form.values.attendees.map((attendee, index) => (
                    <div className={styles.rating} key={attendee.membershipId}>
                        <RatingControl
                            label={`Rating for ${members.find((member) => member.id === attendee.membershipId)?.displayName ?? 'attendee'} (optional)`}
                            name={`rating-${attendee.membershipId}`}
                            value={attendee.score ?? 0}
                            onChange={(score) =>
                                form.setFieldValue(`attendees.${index}.score`, score)
                            }
                            disabled={isDisabled}
                        />
                        {attendee.score !== undefined ? (
                            <Button
                                variant="ghost"
                                disabled={isDisabled}
                                onClick={() =>
                                    form.setFieldValue(
                                        'attendees',
                                        form.values.attendees.map((row) =>
                                            row.membershipId === attendee.membershipId
                                                ? { membershipId: row.membershipId }
                                                : row,
                                        ),
                                    )
                                }
                            >
                                Clear rating
                            </Button>
                        ) : null}
                    </div>
                ))}
                <p>Ratings are imported historical records, separate from live submissions.</p>
            </fieldset>
            <PastNominations
                evidence={{
                    nominations: form.values.nominations,
                    scoreMatrix: form.values.scoreMatrix,
                }}
                attendees={form.values.attendees}
                members={members}
                scaleMin={scaleMin}
                scaleMax={scaleMax}
                disabled={isDisabled}
                error={form.errors.nominations ?? form.errors.scoreMatrix}
                onChange={(evidence) => form.setValues(evidence)}
            />
            <div className={styles.submit}>
                <Button fullWidth disabled={isDisabled} loading={isPending} type="submit">
                    Log Session
                </Button>
                <p aria-live="polite" aria-atomic="true" role="status">
                    {message}
                </p>
            </div>
        </form>
    );
}
