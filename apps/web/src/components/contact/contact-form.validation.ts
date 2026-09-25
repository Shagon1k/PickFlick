import {
    CONTACT_EMAIL_MAX_LENGTH,
    CONTACT_MESSAGE_MAX_LENGTH,
    CONTACT_NAME_MAX_LENGTH,
} from '@pickflick/contracts';

import type { ContactFieldErrors, ContactFormValues } from './contact-form.types';

export function contactValues(formData: FormData): ContactFormValues {
    return {
        message: String(formData.get('message') ?? ''),
        name: String(formData.get('name') ?? ''),
        email: String(formData.get('email') ?? ''),
    };
}

export function validateContactValues(values: ContactFormValues): ContactFieldErrors {
    const errors: ContactFieldErrors = {};
    const message = values.message.trim();
    if (!message) {
        errors.message = 'Enter a message.';
    } else if (values.message.length > CONTACT_MESSAGE_MAX_LENGTH) {
        errors.message = `Keep the message to ${CONTACT_MESSAGE_MAX_LENGTH} characters.`;
    }
    if (values.name.trim().length > CONTACT_NAME_MAX_LENGTH) {
        errors.name = `Keep your name to ${CONTACT_NAME_MAX_LENGTH} characters.`;
    }
    const email = values.email.trim();
    if (
        email.length > CONTACT_EMAIL_MAX_LENGTH ||
        (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ) {
        errors.email = 'Enter a valid email address or leave this blank.';
    }
    return errors;
}
