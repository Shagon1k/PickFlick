import type { ReactNode } from 'react';

import styles from './Field.module.scss';

export interface IFieldMessageProps {
    error?: ReactNode;
    hint?: string;
    success?: string;
    shouldAlignEnd?: boolean;
}

function getMessageTone({ error, success }: IFieldMessageProps): 'danger' | 'success' | 'neutral' {
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
            data-align={props.shouldAlignEnd ? 'end' : undefined}
            data-tone={getMessageTone(props)}
        >
            {message}
        </span>
    );
}
