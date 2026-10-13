'use client';

import { useForm } from '@mantine/form';
import type { TSession } from '@pickflick/contracts';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

import MoviePicker from '@/components/sessions/MoviePicker/MoviePicker';
import Button from '@/components/ui/Button/Button';
import ButtonLink from '@/components/ui/Button/ButtonLink';
import Switch from '@/components/ui/Switch/Switch';
import Textarea from '@/components/ui/Textarea/Textarea';
import TextInput from '@/components/ui/TextInput/TextInput';
import { focusFirstInvalid } from '@/lib/form-errors';

import { saveSessionAction } from './actions';
import { type ISessionValues, sessionInput, validateSession } from './session-form';
import styles from './SessionForm.module.scss';

interface ISessionFormProps {
    clubId: string;
    session?: TSession;
    onSaved?: () => void;
    creationRestriction?: 'blocking' | 'permission';
}
export default function SessionForm({
    clubId,
    session,
    onSaved,
    creationRestriction,
}: ISessionFormProps) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const [message, setMessage] = useState('');
    const [created, setCreated] = useState<TSession | null>(null);
    const form = useForm<ISessionValues>({
        initialValues: {
            date: session?.scheduledAt?.slice(0, 10) ?? '',
            location: session?.location ?? '',
            topic: session?.topic ?? '',
            notes: session?.notes ?? '',
            type: session?.type === 'PRE_SELECTED' ? 'PRE_SELECTED' : 'FULL_CYCLE',
            duration: '',
            removeDeadline: false,
            movieId: session?.movieId ?? null,
        },
        validate: (values) => validateSession(values, session),
    });
    const submit = (event: React.SubmitEvent<HTMLFormElement>) =>
        form.onSubmit(
            (values, event) => {
                const [hours = '0', minutes = '0'] = values.duration.split(':');
                let deadlineAt = session?.deadlineAt ?? null;
                if (values.removeDeadline) deadlineAt = null;
                else if (values.type === 'FULL_CYCLE' && values.duration) {
                    deadlineAt = new Date(
                        Date.now() + (Number(hours) * 60 + Number(minutes)) * 60_000,
                    ).toISOString();
                }
                const input = sessionInput(values, deadlineAt, session);
                const element = event?.currentTarget;
                setMessage('Saving Session…');
                startTransition(async () => {
                    const result = await saveSessionAction(
                        clubId,
                        session?.id ?? null,
                        input,
                    ).catch(() => ({
                        ok: false as const,
                        message:
                            'We could not reach PickFlick. Your entries are still here; try again.',
                    }));
                    if (!result.ok) {
                        setMessage(result.message);
                        focusFirstInvalid(element);
                        return;
                    }
                    setMessage(session ? 'Session details saved.' : 'Session created.');
                    if (session) {
                        onSaved?.();
                        router.refresh();
                    } else setCreated(result.session);
                });
            },
            (_errors, _values, event) => {
                setMessage('Review the highlighted fields and try again.');
                focusFirstInvalid(event?.currentTarget);
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
        <form className={styles.form} noValidate onSubmit={submit}>
            <TextInput
                {...form.getInputProps('date')}
                disabled={pending}
                id="session-date"
                label="Date"
                labelHint="required"
                type="date"
                required
            />
            <TextInput
                {...form.getInputProps('location')}
                disabled={pending}
                id="session-location"
                label="Location"
                labelHint="required"
                maxLength={200}
                placeholder="e.g. Sarah’s place, Zoom, Alamo Drafthouse"
                required
            />
            <TextInput
                {...form.getInputProps('topic')}
                disabled={pending}
                id="session-topic"
                label="Topic"
                labelHint="optional"
                maxLength={200}
            />
            <Textarea
                {...form.getInputProps('notes')}
                disabled={pending}
                id="session-notes"
                label="Notes"
                labelHint="optional"
                maxLength={2000}
                size="compact"
            />
            {!session ? (
                <fieldset className={styles.modes} disabled={pending}>
                    <legend>Session type</legend>
                    <label>
                        <input
                            checked={form.values.type === 'FULL_CYCLE'}
                            name="session-type"
                            type="radio"
                            value="FULL_CYCLE"
                            onChange={() =>
                                form.setValues({ type: 'FULL_CYCLE', movieId: null, duration: '' })
                            }
                        />
                        Full cycle
                    </label>
                    <label>
                        <input
                            checked={form.values.type === 'PRE_SELECTED'}
                            name="session-type"
                            type="radio"
                            value="PRE_SELECTED"
                            onChange={() => form.setValues({ type: 'PRE_SELECTED', duration: '' })}
                        />
                        Pre-selected Movie
                    </label>
                </fieldset>
            ) : null}
            {form.values.type === 'FULL_CYCLE' && (!session || session.phase === 'NOMINATION') ? (
                <TextInput
                    {...form.getInputProps('duration')}
                    disabled={pending || form.values.removeDeadline}
                    id="session-deadline"
                    label="Nomination phase ends in"
                    labelHint="optional"
                    maxLength={5}
                    placeholder="hh:mm"
                    hint={
                        session?.deadlineAt
                            ? `Current deadline: ${session.deadlineAt}. Leave blank to keep it.`
                            : 'hh:mm from now. Leave blank for no deadline.'
                    }
                />
            ) : null}
            {session?.phase === 'NOMINATION' && session.deadlineAt ? (
                <Switch
                    {...form.getInputProps('removeDeadline', { type: 'checkbox' })}
                    disabled={pending}
                    label="Remove nomination deadline"
                />
            ) : null}
            {!session && form.values.type === 'PRE_SELECTED' ? (
                <MoviePicker
                    disabled={pending}
                    error={form.errors.movieId}
                    value={form.values.movieId}
                    onChange={(movieId) => form.setFieldValue('movieId', movieId)}
                />
            ) : null}
            <div className={styles.submit}>
                <Button fullWidth loading={pending} type="submit">
                    {session ? 'Save changes' : 'Create Session'}
                </Button>
                <p aria-atomic="true" aria-live="polite" role="status">
                    {message}
                </p>
            </div>
        </form>
    );
}

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
            <ButtonLink href={`/sessions/${session.id}`} variant="primary">
                Open Session
            </ButtonLink>
            <ButtonLink href={`/clubs/${session.clubId}`}>Back to Club Hub</ButtonLink>
        </div>
    );
}
