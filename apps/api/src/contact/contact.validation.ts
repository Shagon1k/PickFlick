import {
    CONTACT_EMAIL_MAX_LENGTH,
    CONTACT_MESSAGE_MAX_LENGTH,
    CONTACT_NAME_MAX_LENGTH,
} from '@pickflick/contracts';

import { ContactValidationError } from './contact.errors.js';
import type { NormalizedContactSubmission } from './contact.types.js';

function hasUnsafeControlCharacter(value: string): boolean {
    return [...value].some((character) => {
        const code = character.codePointAt(0) ?? 0;
        return (code < 32 && code !== 9 && code !== 10) || code === 127;
    });
}

function optionalString(
    value: unknown,
    maxLength: number,
    singleLine: boolean,
): string | undefined {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    if (typeof value !== 'string') {
        throw new ContactValidationError();
    }
    const normalized = value.trim();
    if (!normalized || normalized.length > maxLength || hasUnsafeControlCharacter(normalized)) {
        throw new ContactValidationError();
    }
    if (singleLine && /[\r\n]/.test(normalized)) {
        throw new ContactValidationError();
    }
    return normalized;
}

export function parseContactSubmission(value: unknown): NormalizedContactSubmission {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        throw new ContactValidationError();
    }
    const input = value as Record<string, unknown>;
    if (
        Object.keys(input).some(
            (key) => !['submissionKey', 'message', 'name', 'email'].includes(key),
        )
    ) {
        throw new ContactValidationError();
    }
    if (
        typeof input.submissionKey !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
            input.submissionKey,
        )
    ) {
        throw new ContactValidationError();
    }
    if (typeof input.message !== 'string') {
        throw new ContactValidationError();
    }
    const message = input.message.replace(/\r\n?/g, '\n').trim();
    if (
        !message ||
        message.length > CONTACT_MESSAGE_MAX_LENGTH ||
        hasUnsafeControlCharacter(message)
    ) {
        throw new ContactValidationError();
    }
    const name = optionalString(input.name, CONTACT_NAME_MAX_LENGTH, true);
    const email = optionalString(input.email, CONTACT_EMAIL_MAX_LENGTH, true)?.toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new ContactValidationError();
    }
    return {
        submissionKey: input.submissionKey.toLowerCase(),
        message,
        ...(name ? { name } : {}),
        ...(email ? { email } : {}),
    };
}
