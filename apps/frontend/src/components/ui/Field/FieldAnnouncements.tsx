import type { ReactNode } from 'react';

interface IFieldAnnouncementsProps {
    error?: ReactNode;
    success?: string;
}

/**
 * Repeats errors and successes into live regions. They sit outside the control's description so
 * a screen reader announces the change without reading the message twice.
 */
export default function FieldAnnouncements({ error, success }: IFieldAnnouncementsProps) {
    return (
        <>
            <span
                aria-atomic="true"
                aria-live="assertive"
                className="visually-hidden"
                data-field-live="error"
            >
                {error}
            </span>
            <span
                aria-atomic="true"
                aria-live="polite"
                className="visually-hidden"
                data-field-live="success"
            >
                {success}
            </span>
        </>
    );
}
