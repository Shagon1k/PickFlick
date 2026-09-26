import type { ReactNode } from 'react';

import styles from './Field.module.scss';

export interface IFieldMessageProps {
    error?: ReactNode;
    hint?: string;
    success?: string;
    alignEnd?: boolean;
}

function messageTone({ error, success }: IFieldMessageProps): 'danger' | 'success' | 'neutral' {
    if (error) {
        return 'danger';
    }
    return success ? 'success' : 'neutral';
}

/** The one message line under a control. It stays mounted so the layout never jumps. */
export default function FieldMessage(props: IFieldMessageProps) {
    const message = props.error ?? props.success ?? props.hint;
    return (
        <span
            aria-hidden={message ? undefined : true}
            className={styles.field__message}
            data-align={props.alignEnd ? 'end' : undefined}
            data-tone={messageTone(props)}
        >
            {message}
        </span>
    );
}

/**
 * Repeats errors and successes into live regions. They sit outside the control's description so
 * a screen reader announces the change without reading the message twice.
 */
export function FieldAnnouncements({ error, success }: { error?: ReactNode; success?: string }) {
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
