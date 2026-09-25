import { contactSubmissionSchema } from '@pickflick/contracts';

import { fieldErrors } from '@/lib/form-errors';

import type { ContactFieldErrors, ContactFormValues } from './contact-form.types';

const FIELD_MESSAGES = {
    message: 'Enter a message of up to 500 characters.',
    name: 'Keep your name to 100 characters on one line.',
    email: 'Enter a valid email address or leave this blank.',
};

export function contactValues(formData: FormData): ContactFormValues {
    return {
        message: String(formData.get('message') ?? ''),
        name: String(formData.get('name') ?? ''),
        email: String(formData.get('email') ?? ''),
    };
}

export function validateContactValues(values: ContactFormValues): ContactFieldErrors {
    const result = contactSubmissionSchema.safeParse(values);
    return result.success ? {} : fieldErrors(result.error, FIELD_MESSAGES);
}
