import { createSessionSchema, type TSession, updateSessionSchema } from '@pickflick/contracts';

import { toFieldErrors } from '@/lib/form-errors';
import { toIsoDate } from '@/lib/format';

const MINUTES_PER_HOUR = 60;
const MINUTE_MS = 60_000;

export interface ISessionValues {
    date: string;
    location: string;
    topic: string;
    notes: string;
    type: 'FULL_CYCLE' | 'PRE_SELECTED';
    duration: string;
    removeDeadline: boolean;
    movieId: string | null;
}

/** Form values for a new Session, or the editable details of an existing one. */
export function getInitialSessionValues(session?: TSession): ISessionValues {
    return {
        date: session?.scheduledAt ? toIsoDate(session.scheduledAt) : '',
        location: session?.location ?? '',
        topic: session?.topic ?? '',
        notes: session?.notes ?? '',
        type: session?.type === 'PRE_SELECTED' ? 'PRE_SELECTED' : 'FULL_CYCLE',
        duration: '',
        removeDeadline: false,
        movieId: session?.movieId ?? null,
    };
}

/** The deadline to save: removed, recalculated from an `hh:mm` duration, or the current one. */
export function nextDeadline(values: ISessionValues, session?: TSession): string | null {
    if (values.removeDeadline) return null;
    if (values.type !== 'FULL_CYCLE' || !values.duration) return session?.deadlineAt ?? null;
    const [hours = '0', minutes = '0'] = values.duration.split(':');
    return new Date(
        Date.now() + (Number(hours) * MINUTES_PER_HOUR + Number(minutes)) * MINUTE_MS,
    ).toISOString();
}

export function buildSessionInput(
    values: ISessionValues,
    deadlineAt: string | null,
    session?: TSession,
) {
    let scheduledAt = /^\d{4}-\d{2}-\d{2}$/u.test(values.date)
        ? `${values.date}T00:00:00.000Z`
        : '';
    if (session?.scheduledAt && toIsoDate(session.scheduledAt) === values.date)
        scheduledAt = session.scheduledAt;
    const details = {
        scheduledAt,
        location: values.location,
        topic: values.topic,
        notes: values.notes,
        deadlineAt,
    };
    return session
        ? { ...details, version: session.version }
        : { ...details, type: values.type, movieId: values.movieId };
}

export function validateSession(values: ISessionValues, session?: TSession) {
    const input = buildSessionInput(values, null, session);
    const parsed = session
        ? updateSessionSchema.safeParse(input)
        : createSessionSchema.safeParse(input);
    const errors = parsed.success
        ? {}
        : toFieldErrors(parsed.error, {
              scheduledAt: 'Choose a valid date.',
              location: 'Use 1–200 characters on one line.',
              topic: 'Use up to 200 characters on one line.',
              notes: 'Use up to 2000 characters.',
              movieId: 'Select a Movie.',
              type: 'Choose a Session type.',
          });
    const { scheduledAt, ...fields } = errors;
    return {
        ...fields,
        ...(scheduledAt ? { date: scheduledAt } : {}),
        ...(!values.removeDeadline &&
        values.duration &&
        (!/^\d{2}:[0-5]\d$/u.test(values.duration) || values.duration === '00:00')
            ? { duration: 'Use hh:mm, greater than 00:00.' }
            : {}),
    };
}
