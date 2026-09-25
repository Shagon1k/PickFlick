import { z } from 'zod';

import { multilineText, optionalText, singleLineText } from '../common/text.js';

export const CONTACT_MESSAGE_MAX_LENGTH = 500;
export const CONTACT_NAME_MAX_LENGTH = 100;
export const CONTACT_EMAIL_MAX_LENGTH = 254;

export const contactSubmissionSchema = z.strictObject({
    message: multilineText(1, CONTACT_MESSAGE_MAX_LENGTH),
    name: optionalText(singleLineText(1, CONTACT_NAME_MAX_LENGTH)),
    email: optionalText(
        z.string().trim().toLowerCase().pipe(z.email().max(CONTACT_EMAIL_MAX_LENGTH)),
    ),
});

export type TContactSubmission = z.infer<typeof contactSubmissionSchema>;
