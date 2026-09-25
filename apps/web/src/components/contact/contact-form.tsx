'use client';

import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

import {
    CONTACT_EMAIL_MAX_LENGTH,
    CONTACT_MESSAGE_MAX_LENGTH,
    CONTACT_NAME_MAX_LENGTH,
} from '@pickflick/contracts';
import { Button, TextAreaField, TextField } from '@pickflick/ui';

import { submitContact } from '../../app/contact/actions';
import { initialFormActionState } from '../forms/form-action.types';
import { useFormAction } from '../forms/use-form-action';
import type { ContactFieldErrors, ContactFieldName, ContactFormValues } from './contact-form.types';
import { validateContactValues } from './contact-form.validation';
import styles from './contact.module.css';

type FeedbackTone = 'neutral' | 'success' | 'danger' | 'warning';

const emptyValues: ContactFormValues = { message: '', name: '', email: '' };
const initialActionState = initialFormActionState<ContactFieldName>();

export function ContactForm() {
    const [values, setValues] = useState<ContactFormValues>(emptyValues);
    const [errors, setErrors] = useState<ContactFieldErrors>({});
    const [feedback, setFeedback] = useState<{ message: string; tone: FeedbackTone }>({
        message: '',
        tone: 'neutral',
    });
    const formRef = useRef<HTMLFormElement>(null);
    const submissionKeyInputRef = useRef<HTMLInputElement>(null);
    const attemptRef = useRef<{ signature: string; key: string } | undefined>(undefined);
    const [actionState, formAction, pending] = useFormAction(
        submitContact,
        initialActionState,
        "We couldn't reach PickFlick. Your text is still here — try again.",
    );

    useEffect(() => {
        if (actionState.revision === 0) {
            return;
        }
        setErrors(actionState.fieldErrors ?? {});
        setFeedback({ message: actionState.message, tone: actionState.tone });
        if (actionState.status === 'success') {
            setValues(emptyValues);
            attemptRef.current = undefined;
        } else if (actionState.fieldErrors) {
            focusFirstError();
        }
    }, [actionState]);

    function update(field: ContactFieldName, value: string): void {
        setValues((current) => ({ ...current, [field]: value }));
        setErrors((current) => {
            const next = { ...current };
            delete next[field];
            return next;
        });
        setFeedback({ message: '', tone: 'neutral' });
    }

    function focusFirstError(): void {
        requestAnimationFrame(() => {
            formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
        });
    }

    function submit(event: FormEvent<HTMLFormElement>): void {
        const nextErrors = validateContactValues(values);
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) {
            event.preventDefault();
            setFeedback({ message: 'Review the highlighted field and try again.', tone: 'danger' });
            focusFirstError();
            return;
        }
        if (!navigator.onLine) {
            event.preventDefault();
            setFeedback({
                message:
                    'You appear to be offline. Reconnect, then send again; your message is still here.',
                tone: 'warning',
            });
            return;
        }

        const payload = {
            message: values.message,
            ...(values.name.trim() ? { name: values.name } : {}),
            ...(values.email.trim() ? { email: values.email } : {}),
        };
        const signature = JSON.stringify(payload);
        if (!attemptRef.current || attemptRef.current.signature !== signature) {
            attemptRef.current = { signature, key: crypto.randomUUID() };
        }
        if (submissionKeyInputRef.current) {
            submissionKeyInputRef.current.value = attemptRef.current.key;
        }
        setFeedback({ message: 'Sending your message…', tone: 'neutral' });
    }

    return (
        <form
            action={formAction}
            className={styles.form}
            noValidate
            onSubmit={submit}
            ref={formRef}
        >
            <input name="submissionKey" ref={submissionKeyInputRef} type="hidden" />
            <TextAreaField
                {...(errors.message ? { error: errors.message } : {})}
                hint={`${values.message.length}/${CONTACT_MESSAGE_MAX_LENGTH}`}
                id="contact-message"
                label="Message"
                labelHint="required"
                maxLength={CONTACT_MESSAGE_MAX_LENGTH}
                name="message"
                disabled={pending}
                onChange={(event) => update('message', event.currentTarget.value)}
                placeholder="Tell us what's on your mind…"
                required
                value={values.message}
            />
            <TextField
                autoComplete="name"
                {...(errors.name ? { error: errors.name } : {})}
                id="contact-name"
                label="Your name"
                labelHint="optional"
                maxLength={CONTACT_NAME_MAX_LENGTH}
                name="name"
                disabled={pending}
                onChange={(event) => update('name', event.currentTarget.value)}
                placeholder="e.g. Jane Doe"
                value={values.name}
            />
            <TextField
                autoComplete="email"
                {...(errors.email ? { error: errors.email } : {})}
                id="contact-email"
                label="Your email"
                labelHint="optional"
                maxLength={CONTACT_EMAIL_MAX_LENGTH}
                name="email"
                disabled={pending}
                onChange={(event) => update('email', event.currentTarget.value)}
                placeholder="e.g. jane@example.com"
                type="email"
                value={values.email}
            />

            <div className={styles.submitZone}>
                <Button
                    className={styles.submitButton}
                    disabled={feedback.tone === 'success'}
                    loading={pending}
                    type="submit"
                >
                    {feedback.tone === 'success' ? 'Message sent' : 'Send message'}
                </Button>
                <p
                    aria-atomic="true"
                    aria-live="polite"
                    className={styles.feedback}
                    data-tone={feedback.tone}
                    role="status"
                    tabIndex={-1}
                >
                    {feedback.message}
                </p>
            </div>
        </form>
    );
}
