import { createSessionSchema, type TSession, updateSessionSchema } from '@pickflick/contracts';

import { fieldErrors } from '@/lib/form-errors';

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

export function sessionInput(
    values: ISessionValues,
    id: string,
    deadlineAt: string | null,
    session?: TSession,
) {
    let scheduledAt = /^\d{4}-\d{2}-\d{2}$/u.test(values.date)
        ? `${values.date}T00:00:00.000Z`
        : '';
    if (session?.scheduledAt?.slice(0, 10) === values.date) scheduledAt = session.scheduledAt;
    const details = {
        scheduledAt,
        location: values.location,
        topic: values.topic,
        notes: values.notes,
        deadlineAt,
    };
    return session
        ? { ...details, version: session.version }
        : { ...details, id, type: values.type, movieId: values.movieId };
}

export function validateSession(values: ISessionValues, session?: TSession) {
    const input = sessionInput(values, '00000000-0000-4000-8000-000000000000', null, session);
    const parsed = session
        ? updateSessionSchema.safeParse(input)
        : createSessionSchema.safeParse(input);
    const errors = parsed.success
        ? {}
        : fieldErrors(parsed.error, {
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
