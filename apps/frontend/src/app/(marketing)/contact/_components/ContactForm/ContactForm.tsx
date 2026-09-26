'use client';

import { useForm } from '@mantine/form';
import {
    CONTACT_EMAIL_MAX_LENGTH,
    CONTACT_MESSAGE_MAX_LENGTH,
    CONTACT_NAME_MAX_LENGTH,
} from '@pickflick/contracts';
import { useState, useTransition } from 'react';

import Button from '@/components/ui/Button/Button';
import Textarea from '@/components/ui/Textarea/Textarea';
import TextInput from '@/components/ui/TextInput/TextInput';
import { focusFirstInvalid, type TFeedbackTone, type TFormResult } from '@/lib/form-errors';

import { sendContact } from '../../actions';
import styles from '../../page.module.scss';
import type { IContactFormValues } from './contact-form.types';
import { validateContactValues } from './contact-form.validation';

const IDLE = { message: '', tone: 'neutral' as TFeedbackTone };

export default function ContactForm() {
    const [pending, startTransition] = useTransition();
    const [feedback, setFeedback] = useState(IDLE);
    const form = useForm<IContactFormValues>({
        initialValues: { message: '', name: '', email: '' },
        validate: validateContactValues,
        onValuesChange: () => setFeedback(IDLE),
    });

    const submit = form.onSubmit(
        (values, event) => {
            const formElement = event?.currentTarget;
            if (!navigator.onLine) {
                setFeedback({
                    message:
                        'You appear to be offline. Reconnect, then send again; your message is still here.',
                    tone: 'warning',
                });
                return;
            }
            setFeedback({ message: 'Sending your message…', tone: 'neutral' });
            startTransition(async () => {
                const result: TFormResult<keyof IContactFormValues> = await sendContact(
                    values,
                ).catch(() => ({
                    ok: false as const,
                    message: "We couldn't reach PickFlick. Your text is still here — try again.",
                    tone: 'danger' as const,
                }));
                if (result.ok) {
                    form.reset();
                    setFeedback({
                        message: "Message received — we'll get back to you soon.",
                        tone: 'success',
                    });
                    return;
                }
                setFeedback({ message: result.message, tone: result.tone });
                if (result.fieldErrors) {
                    form.setErrors(result.fieldErrors);
                    focusFirstInvalid(formElement);
                }
            });
        },
        (_errors, _values, event) => {
            setFeedback({ message: 'Review the highlighted field and try again.', tone: 'danger' });
            focusFirstInvalid(event?.currentTarget);
        },
    );

    const sent = feedback.tone === 'success';
    return (
        <form className={styles.form} noValidate onSubmit={submit}>
            <Textarea
                {...form.getInputProps('message')}
                disabled={pending}
                id="contact-message"
                label="Message"
                labelHint="required"
                maxLength={CONTACT_MESSAGE_MAX_LENGTH}
                placeholder="Tell us what's on your mind…"
                required
                showCount
                size="large"
            />
            <TextInput
                {...form.getInputProps('name')}
                autoComplete="name"
                disabled={pending}
                id="contact-name"
                label="Your name"
                labelHint="optional"
                maxLength={CONTACT_NAME_MAX_LENGTH}
                placeholder="e.g. Jane Doe"
            />
            <TextInput
                {...form.getInputProps('email')}
                autoComplete="email"
                disabled={pending}
                id="contact-email"
                label="Your email"
                labelHint="optional"
                maxLength={CONTACT_EMAIL_MAX_LENGTH}
                placeholder="e.g. jane@example.com"
                type="email"
            />

            <div className={styles.submitZone}>
                <Button disabled={sent} fullWidth loading={pending} type="submit">
                    {sent ? 'Message sent' : 'Send message'}
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
