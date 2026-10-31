'use client';

import { useForm } from '@mantine/form';
import {
    SESSION_LOCATION_MAX_LENGTH,
    SESSION_NOTES_MAX_LENGTH,
    SESSION_TOPIC_MAX_LENGTH,
    type TSession,
} from '@pickflick/contracts';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import MoviePicker from '#components/sessions/MoviePicker/MoviePicker';
import SessionLink from '#components/sessions/SessionLink/SessionLink';
import Button from '#components/ui/Button/Button';
import ButtonLink from '#components/ui/Button/ButtonLink';
import Switch from '#components/ui/Switch/Switch';
import Textarea from '#components/ui/Textarea/Textarea';
import TextInput from '#components/ui/TextInput/TextInput';
import { focusFirstInvalid } from '#lib/form-errors';
import { formatInstant } from '#lib/format';
import { useActionStatus } from '#lib/use-action-status';
import { useViewerTimeZone } from '#lib/use-is-hydrated';

import { saveSessionAction } from './actions';
import {
    buildSessionInput,
    getInitialSessionValues,
    getNextDeadline,
    type ISessionValues,
    validateSession,
} from './session-form';
import styles from './SessionForm.module.scss';

// The deadline field takes `hh:mm`.
const DURATION_INPUT_LENGTH = 5;

interface ISessionFormProps {
    clubId: string;
    session?: TSession;
    onSaved?: () => void;
    onCancel?: () => void;
    creationRestriction?: 'blocking' | 'permission';
}
export default function SessionForm({
    clubId,
    session,
    onSaved,
    onCancel,
    creationRestriction,
}: ISessionFormProps) {
    const router = useRouter();
    const { message, setMessage, isPending, run } = useActionStatus();
    const timeZone = useViewerTimeZone();
    const [created, setCreated] = useState<TSession | null>(null);
    const form = useForm<ISessionValues>({
        initialValues: getInitialSessionValues(session),
        validate: (values) => validateSession(values, session),
    });
    function save(values: ISessionValues, element?: HTMLFormElement) {
        const input = buildSessionInput(values, getNextDeadline(values, session), session);
        run(() => saveSessionAction(clubId, session?.id ?? null, input), {
            pendingMessage: 'Saving Session…',
            unreachableMessage:
                'We could not reach PickFlick. Your entries are still here; try again.',
            onResult: (result) => {
                if (!result.ok) {
                    setMessage(result.message);
                    focusFirstInvalid(element);
                    return;
                }
                setMessage(session ? 'Session details saved.' : 'Session created.');
                if (!session) {
                    setCreated(result.session);
                    return;
                }
                onSaved?.();
                router.refresh();
            },
        });
    }
    const handleSubmit = (event: React.SubmitEvent<HTMLFormElement>) =>
        form.onSubmit(
            (values, submitEvent) => save(values, submitEvent?.currentTarget),
            (_errors, _values, invalidEvent) => {
                setMessage('Review the highlighted fields and try again.');
                focusFirstInvalid(invalidEvent?.currentTarget);
            },
        )(event);
    if (created) return <SessionResult session={created} />;
    if (creationRestriction)
        return (
            <>
                <p role="status">{CREATION_RESTRICTIONS[creationRestriction]}</p>
                <ButtonLink href={`/clubs/${clubId}`}>Back to Club Hub</ButtonLink>
            </>
        );
    return (
        <form className={styles.form} noValidate onSubmit={handleSubmit}>
            <TextInput
                {...form.getInputProps('date')}
                disabled={isPending}
                id="session-date"
                label="Date"
                labelHint="required"
                type="date"
                required
            />
            <TextInput
                {...form.getInputProps('location')}
                disabled={isPending}
                id="session-location"
                label="Location"
                labelHint="required"
                maxLength={SESSION_LOCATION_MAX_LENGTH}
                placeholder="e.g. Sarah’s place, Zoom, Alamo Drafthouse"
                required
            />
            <TextInput
                {...form.getInputProps('topic')}
                disabled={isPending}
                id="session-topic"
                label="Topic"
                labelHint="optional"
                maxLength={SESSION_TOPIC_MAX_LENGTH}
                placeholder="e.g. Best of 2020s cinema"
            />
            <Textarea
                {...form.getInputProps('notes')}
                disabled={isPending}
                id="session-notes"
                label="Notes"
                labelHint="optional"
                maxLength={SESSION_NOTES_MAX_LENGTH}
                placeholder="Anything members should know before the session?"
                size="compact"
            />
            {!session ? (
                <SessionTypeField
                    disabled={isPending}
                    value={form.values.type}
                    onChange={(type) =>
                        form.setValues(
                            type === 'FULL_CYCLE'
                                ? { type, movieId: null, duration: '' }
                                : { type, duration: '' },
                        )
                    }
                />
            ) : null}
            {form.values.type === 'FULL_CYCLE' && (!session || session.phase === 'NOMINATION') ? (
                <TextInput
                    {...form.getInputProps('duration')}
                    disabled={isPending || form.values.removeDeadline}
                    id="session-deadline"
                    label="Nomination phase ends in"
                    labelHint="optional"
                    maxLength={DURATION_INPUT_LENGTH}
                    placeholder="hh:mm from now"
                    hint={describeDeadline(session?.deadlineAt, timeZone)}
                />
            ) : null}
            {session?.phase === 'NOMINATION' && session.deadlineAt ? (
                <Switch
                    {...form.getInputProps('removeDeadline', { type: 'checkbox' })}
                    disabled={isPending}
                    label="Remove nomination deadline"
                />
            ) : null}
            {!session && form.values.type === 'PRE_SELECTED' ? (
                <MoviePicker
                    disabled={isPending}
                    error={form.errors.movieId}
                    placeholder="Search films by title…"
                    value={form.values.movieId}
                    onChange={(movieId) => form.setFieldValue('movieId', movieId)}
                />
            ) : null}
            <SessionFormActions
                isEditing={Boolean(session)}
                isPending={isPending}
                message={message}
                onCancel={onCancel}
            />
        </form>
    );
}

function SessionFormActions({
    isEditing,
    isPending,
    message,
    onCancel,
}: {
    isEditing: boolean;
    isPending: boolean;
    message: string;
    onCancel?: () => void;
}) {
    return (
        <div className={isEditing ? styles.edit : styles.submit}>
            {isEditing ? (
                <div className={styles.editActions}>
                    <Button disabled={isPending} onClick={onCancel} variant="secondary">
                        Cancel
                    </Button>
                    <Button loading={isPending} type="submit">
                        Save
                    </Button>
                </div>
            ) : (
                <Button fullWidth loading={isPending} type="submit">
                    Create Session
                </Button>
            )}
            <p aria-atomic="true" aria-live="polite" role="status">
                {message}
            </p>
        </div>
    );
}

function SessionTypeField({
    disabled,
    onChange,
    value,
}: {
    disabled: boolean;
    value: ISessionValues['type'];
    onChange: (type: ISessionValues['type']) => void;
}) {
    return (
        <fieldset className={styles.modes} disabled={disabled}>
            <legend>Session type</legend>
            <div className={styles.modeOptions}>
                {SESSION_TYPES.map(({ type, label }) => (
                    <label key={type}>
                        <input
                            checked={value === type}
                            name="session-type"
                            type="radio"
                            value={type}
                            onChange={() => onChange(type)}
                        />
                        {label}
                    </label>
                ))}
            </div>
        </fieldset>
    );
}

const SESSION_TYPES = [
    { type: 'FULL_CYCLE', label: 'Full cycle' },
    { type: 'PRE_SELECTED', label: 'Pre-selected Movie' },
] as const;

const CREATION_RESTRICTIONS = {
    blocking: 'This Club already has a Session in Nomination, Selection, or Watching.',
    permission: 'You cannot create a Session in this Club right now.',
} as const;

function SessionResult({ session }: { session: TSession }) {
    let phaseMessage = `Current phase: ${session.phase.toLowerCase()}.`;
    if (session.phase === 'NOMINATION') phaseMessage = 'Nomination is open.';
    else if (session.phase === 'WATCHING') phaseMessage = 'Your Movie is ready for Watching.';
    return (
        <div className={styles.result}>
            <p role="status">Session created. {phaseMessage}</p>
            <SessionLink sessionId={session.id} />
            <ButtonLink href={`/sessions/${session.id}`} variant="primary">
                Open Session
            </ButtonLink>
            <ButtonLink href={`/clubs/${session.clubId}`}>Back to Club Hub</ButtonLink>
        </div>
    );
}

function describeDeadline(deadlineAt: string | null | undefined, timeZone: string | undefined) {
    if (!deadlineAt) return undefined;
    return `Ends ${formatInstant(deadlineAt, 'dateTime', timeZone)}. Leave blank to keep it.`;
}
