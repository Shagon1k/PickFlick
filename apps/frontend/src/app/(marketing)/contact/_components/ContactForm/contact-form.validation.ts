import { contactSubmissionSchema } from '@pickflick/contracts';

import { toFieldErrors } from '#lib/form-errors';

import type { IContactFormValues, TContactFieldErrors } from './contact-form.types';

const FIELD_MESSAGES = {
    message: 'Enter a message of up to 500 characters.',
    name: 'Keep your name to 100 characters on one line.',
    email: 'Enter a valid email address or leave this blank.',
};

export function validateContactValues(values: IContactFormValues): TContactFieldErrors {
    const result = contactSubmissionSchema.safeParse(values);
    return result.success ? {} : toFieldErrors(result.error, FIELD_MESSAGES);
}
