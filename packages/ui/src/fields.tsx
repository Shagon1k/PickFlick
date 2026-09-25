import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

import { classes, descriptionIds } from './utilities.js';

/** Feedback state shared by fields: an error outranks success, and neither leaves it unset. */
export function controlState(error: unknown, success: unknown): 'error' | 'success' | undefined {
    if (error) {
        return 'error';
    }
    return success ? 'success' : undefined;
}

function messageTone(error: unknown, success: unknown): 'danger' | 'success' | 'neutral' {
    if (error) {
        return 'danger';
    }
    return success ? 'success' : 'neutral';
}

interface FieldMessageProps {
    readonly error?: string | undefined;
    readonly hint?: string | undefined;
    readonly success?: string | undefined;
    readonly messageId: string;
}

export function FieldMessage({ error, hint, messageId, success }: FieldMessageProps) {
    const message = error ?? success ?? hint;

    return (
        <>
            <span
                aria-hidden={message ? undefined : true}
                className="pf-field__message"
                data-tone={messageTone(error, success)}
                id={messageId}
            >
                {message}
            </span>
            <span
                aria-atomic="true"
                aria-live="assertive"
                className="pf-visually-hidden"
                data-field-live="error"
            >
                {error}
            </span>
            <span
                aria-atomic="true"
                aria-live="polite"
                className="pf-visually-hidden"
                data-field-live="success"
            >
                {success}
            </span>
        </>
    );
}

export function FieldLabel({
    hint,
    htmlFor,
    label,
}: Readonly<{ hint?: string | undefined; htmlFor: string; label: string }>) {
    return (
        <label className="pf-field__label" htmlFor={htmlFor}>
            {label}
            {hint ? <span className="pf-field__label-hint"> — {hint}</span> : null}
        </label>
    );
}

export interface SharedFieldProps {
    readonly id: string;
    readonly label: string;
    /** Quiet qualifier rendered inside the label, such as "required" or "optional". */
    readonly labelHint?: string;
    readonly error?: string;
    readonly hint?: string;
    readonly success?: string;
    readonly className?: string;
}

export interface TextFieldProps
    extends SharedFieldProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'id'> {}

export function TextField({
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    className,
    error,
    hint,
    id,
    label,
    labelHint,
    success,
    ...props
}: TextFieldProps) {
    const messageId = `${id}-message`;
    const hasMessage = Boolean(error ?? success ?? hint);

    return (
        <div className={classes('pf-field', className)}>
            <FieldLabel hint={labelHint} htmlFor={id} label={label} />
            <input
                {...props}
                aria-describedby={descriptionIds(
                    ariaDescribedBy,
                    hasMessage ? messageId : undefined,
                )}
                aria-invalid={ariaInvalid ?? (error ? true : undefined)}
                className="pf-control"
                data-state={controlState(error, success)}
                id={id}
            />
            <FieldMessage error={error} hint={hint} messageId={messageId} success={success} />
        </div>
    );
}

export interface TextAreaFieldProps
    extends
        SharedFieldProps,
        Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'className' | 'id'> {}

export function TextAreaField({
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    className,
    error,
    hint,
    id,
    label,
    labelHint,
    success,
    ...props
}: TextAreaFieldProps) {
    const messageId = `${id}-message`;
    const hasMessage = Boolean(error ?? success ?? hint);

    return (
        <div className={classes('pf-field', className)}>
            <FieldLabel hint={labelHint} htmlFor={id} label={label} />
            <textarea
                {...props}
                aria-describedby={descriptionIds(
                    ariaDescribedBy,
                    hasMessage ? messageId : undefined,
                )}
                aria-invalid={ariaInvalid ?? (error ? true : undefined)}
                className="pf-control pf-control--textarea"
                data-state={controlState(error, success)}
                id={id}
            />
            <FieldMessage error={error} hint={hint} messageId={messageId} success={success} />
        </div>
    );
}
