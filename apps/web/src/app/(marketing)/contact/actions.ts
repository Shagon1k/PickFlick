'use server';

import { contactSubmissionSchema } from '@pickflick/contracts';

import { sendContactMessage } from '@/api/contact.server';
import type { FormActionState } from '@/components/forms/form-action.types';
import { ApiError } from '@/lib/api.server';

import type { ContactFieldName } from './_components/ContactForm/contact-form.types';
import {
    contactValues,
    validateContactValues,
} from './_components/ContactForm/contact-form.validation';

type TContactState = FormActionState<ContactFieldName>;

function result(previous: TContactState, state: Omit<TContactState, 'revision'>): TContactState {
    return { ...state, revision: previous.revision + 1 };
}

export async function submitContact(
    previous: TContactState,
    formData: FormData,
): Promise<TContactState> {
    const values = contactValues(formData);
    const parsed = contactSubmissionSchema.safeParse(values);
    if (!parsed.success) {
        return result(previous, {
            status: 'error',
            message: 'Review the highlighted field and try again.',
            tone: 'danger',
            fieldErrors: validateContactValues(values),
        });
    }

    try {
        await sendContactMessage(parsed.data);
        return result(previous, {
            status: 'success',
            message: "Message received — we'll get back to you soon.",
            tone: 'success',
        });
    } catch (error) {
        const rateLimited = error instanceof ApiError && error.status === 429;
        return result(previous, {
            status: 'error',
            message: rateLimited
                ? 'Too many messages were sent from this connection. Try again in 10 minutes.'
                : "We couldn't send your message. Your text is still here — try again.",
            tone: rateLimited ? 'warning' : 'danger',
        });
    }
}
