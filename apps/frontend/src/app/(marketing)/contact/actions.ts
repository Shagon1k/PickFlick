'use server';

import { contactSubmissionSchema } from '@pickflick/contracts';

import { sendContactMessage } from '@/api/contact.server';
import { ApiError } from '@/lib/api.server';
import type { TFormResult } from '@/lib/form-errors';

import type {
    IContactFormValues,
    TContactFieldName,
} from './_components/ContactForm/contact-form.types';
import { validateContactValues } from './_components/ContactForm/contact-form.validation';

export async function sendContact(
    values: IContactFormValues,
): Promise<TFormResult<TContactFieldName>> {
    const parsed = contactSubmissionSchema.safeParse(values);
    if (!parsed.success) {
        return {
            ok: false,
            message: 'Review the highlighted field and try again.',
            tone: 'danger',
            fieldErrors: validateContactValues(values),
        };
    }

    try {
        await sendContactMessage(parsed.data);
        return { ok: true };
    } catch (error) {
        if (error instanceof ApiError && error.status === 429) {
            return {
                ok: false,
                message:
                    'Too many messages were sent from this connection. Try again in 10 minutes.',
                tone: 'warning',
            };
        }
        return {
            ok: false,
            message: "We couldn't send your message. Your text is still here — try again.",
            tone: 'danger',
        };
    }
}
