'use client';

import { useForm } from '@mantine/form';
import {
    createPastSessionSchema,
    SESSION_LOCATION_MAX_LENGTH,
    SESSION_NOTES_MAX_LENGTH,
    SESSION_TOPIC_MAX_LENGTH,
    type TCreatePastSession,
    type TPastSessionMembers,
} from '@pickflick/contracts';
import { useRouter } from 'next/navigation';
import { useLayoutEffect, useRef, useState } from 'react';

import MoviePicker from '#components/sessions/MoviePicker/MoviePicker';
import Button from '#components/ui/Button/Button';
import Textarea from '#components/ui/Textarea/Textarea';
import TextInput from '#components/ui/TextInput/TextInput';
import { focusFirstInvalid, toFieldErrors } from '#lib/form-errors';
import { useActionStatus } from '#lib/use-action-status';
import { useIsHydrated } from '#lib/use-is-hydrated';

import { savePastSessionAction } from '../../actions';
import PastNominations from '../PastNominations/PastNominations';
import PastAttendees from './PastAttendees';
import styles from './PastSessionForm.module.scss';

interface IPastSessionValues {
    date: string;
    time: string;
    location: string;
    topic: string;
    notes: string;
    movieId: string;
    attendees: TCreatePastSession['attendees'];
    nominations: TCreatePastSession['nominations'];
    scoreMatrix: TCreatePastSession['scoreMatrix'];
}

const STEPS = ['Film and date', 'Who came', 'Nominations'] as const;
const FILM_FIELDS = ['movieId', 'date', 'location', 'topic', 'notes'] as const;

/** Three short steps: the film and date, who came with their ratings, then optional nominations. */
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
    const router = useRouter();
    const { message, setMessage, isPending, run } = useActionStatus();
    // Early input would be lost when React first updates these controlled fields.
    const isReady = useIsHydrated();
    const isDisabled = !isReady || isPending;
    const [step, setStep] = useState(0);
    const [titles, setTitles] = useState<Record<string, string>>({});
    const formRef = useRef<HTMLFormElement>(null);
    const shouldFocusStepRef = useRef(false);
    useLayoutEffect(() => {
        if (!shouldFocusStepRef.current) return;
        formRef.current?.querySelector<HTMLElement>('[data-step-heading]')?.focus();
        shouldFocusStepRef.current = false;
    }, [step]);
    const submissionIdRef = useRef<string | null>(null);
    function buildInput({ date, time, ...values }: IPastSessionValues) {
        submissionIdRef.current ??= crypto.randomUUID();
        return {
            ...values,
            scheduledAt: date ? `${date}T${time || '00:00'}:00.000Z` : '',
            submissionId: submissionIdRef.current,
        };
    }
    const form = useForm<IPastSessionValues>({
        initialValues: {
            date: '',
            time: '',
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
            // The schema allows for every zone; the viewer's own calendar decides "in the past".
            const isFuture = values.date > new Date().toLocaleDateString('en-CA');
            if (parsed.success) return isFuture ? { date: 'Choose a valid date in the past.' } : {};
            const { scheduledAt, ...errors } = toFieldErrors(parsed.error, {
                scheduledAt: 'Choose a valid date in the past.',
                location: 'Use 1–200 characters on one line.',
                topic: 'Use up to 200 characters on one line.',
                notes: 'Use up to 2000 characters.',
                movieId: 'Select a Movie.',
                nominations:
                    'Use at most one nomination per selected attendee, with each film and nominator chosen once.',
            });
            return { ...errors, date: scheduledAt };
        },
    });
    function setAttendance(membershipId: string, isAttending: boolean) {
        if (isAttending) {
            form.insertListItem('attendees', { membershipId });
            return;
        }
        // A departed attendee takes their recorded Selection scores with them.
        form.setValues({
            attendees: form.values.attendees.filter((row) => row.membershipId !== membershipId),
            scoreMatrix: form.values.scoreMatrix.filter((row) => row.membershipId !== membershipId),
        });
    }
    function goTo(next: number) {
        if (next > step && step === 0) {
            const errors = FILM_FIELDS.filter((field) => form.validateField(field).hasError);
            if (errors.length) {
                setMessage('Review the highlighted fields and try again.');
                requestAnimationFrame(() => focusFirstInvalid(formRef.current ?? undefined));
                return;
            }
        }
        setMessage('');
        shouldFocusStepRef.current = true;
        setStep(next);
    }
    function save(values: IPastSessionValues) {
        run(() => savePastSessionAction(clubId, buildInput(values)), {
            pendingMessage: 'Logging Session…',
            unreachableMessage:
                'We could not reach PickFlick. Your entries are still here; try again.',
            onResult: (result) => {
                if (result.ok) router.push(`/sessions/${result.session.id}`);
                else setMessage(result.message);
            },
        });
    }
    return (
        <form
            noValidate
            ref={formRef}
            onSubmit={(event) => {
                // Enter inside an early step moves on instead of logging a half-filled Session.
                if (step < STEPS.length - 1) {
                    event.preventDefault();
                    goTo(step + 1);
                    return;
                }
                form.onSubmit(save, (_errors, _values, submitEvent) => {
                    setMessage('Review the highlighted fields and try again.');
                    focusFirstInvalid(submitEvent?.currentTarget);
                })(event);
            }}
        >
            <ol className={styles.steps} aria-label="Steps">
                {STEPS.map((name, index) => (
                    <li
                        aria-current={index === step ? 'step' : undefined}
                        data-done={index <= step || undefined}
                        key={name}
                    >
                        <span className="visually-hidden">
                            Step {index + 1} of {STEPS.length}: {name}
                        </span>
                    </li>
                ))}
            </ol>
            {step === 0 ? (
                <div className={styles.step}>
                    <h2 className={styles.stepTitle} data-step-heading tabIndex={-1}>
                        Which film, and when?
                    </h2>
                    <MoviePicker
                        value={form.values.movieId || null}
                        selectedTitle={titles[form.values.movieId]}
                        onChange={(movie) => {
                            form.setFieldValue('movieId', movie?.id ?? '');
                            if (movie) {
                                const id = movie.id;
                                setTitles({
                                    ...titles,
                                    [id]: movie.title ?? movie.originalTitle ?? 'Untitled film',
                                });
                                // Default once on selection; Back/Next keeps explicit removals.
                                if (!form.values.nominations.some((row) => row.movieId === id))
                                    form.setFieldValue('nominations', [
                                        { movieId: id },
                                        ...form.values.nominations,
                                    ]);
                            }
                        }}
                        disabled={isDisabled}
                        error={form.errors.movieId}
                        placeholder="Search films by title…"
                    />
                    <div className={styles.when}>
                        <TextInput
                            {...form.getInputProps('date')}
                            id="past-date"
                            label="Date"
                            type="date"
                            required
                            disabled={isDisabled}
                        />
                        <TextInput
                            {...form.getInputProps('time')}
                            id="past-time"
                            label="Time"
                            type="time"
                            disabled={isDisabled}
                        />
                    </div>
                    <TextInput
                        {...form.getInputProps('location')}
                        id="past-location"
                        label="Location"
                        maxLength={SESSION_LOCATION_MAX_LENGTH}
                        placeholder="e.g. Sarah’s place, Zoom, Alamo Drafthouse"
                        required
                        disabled={isDisabled}
                    />
                    <TextInput
                        {...form.getInputProps('topic')}
                        id="past-topic"
                        label="Topic"
                        maxLength={SESSION_TOPIC_MAX_LENGTH}
                        disabled={isDisabled}
                    />
                    <Textarea
                        {...form.getInputProps('notes')}
                        id="past-notes"
                        label="Notes"
                        maxLength={SESSION_NOTES_MAX_LENGTH}
                        size="compact"
                        disabled={isDisabled}
                    />
                </div>
            ) : null}
            {step === 1 ? (
                <PastAttendees
                    members={members}
                    attendees={form.values.attendees}
                    disabled={isDisabled}
                    onToggle={setAttendance}
                    onRate={(index, score) => form.setFieldValue(`attendees.${index}.score`, score)}
                />
            ) : null}
            {step === 2 ? (
                <PastNominations
                    evidence={{
                        nominations: form.values.nominations,
                        scoreMatrix: form.values.scoreMatrix,
                    }}
                    attendees={form.values.attendees}
                    members={members}
                    titles={titles}
                    onTitlesChange={setTitles}
                    scaleMin={scaleMin}
                    scaleMax={scaleMax}
                    disabled={isDisabled}
                    error={form.errors.nominations ?? form.errors.scoreMatrix}
                    onChange={(evidence) => form.setValues(evidence)}
                />
            ) : null}
            <div className={styles.submit}>
                {step > 0 ? (
                    <Button
                        disabled={isDisabled}
                        onClick={() => goTo(step - 1)}
                        variant="secondary"
                    >
                        Back
                    </Button>
                ) : null}
                {step < STEPS.length - 1 ? (
                    <Button
                        disabled={isDisabled}
                        onClick={(event) => {
                            // The last Next becomes a submit button before this click finishes.
                            event.preventDefault();
                            goTo(step + 1);
                        }}
                    >
                        Next
                    </Button>
                ) : (
                    <Button disabled={isDisabled} loading={isPending} type="submit">
                        Log Session
                    </Button>
                )}
            </div>
            <p className={styles.status} aria-live="polite" aria-atomic="true" role="status">
                {message}
            </p>
        </form>
    );
}
