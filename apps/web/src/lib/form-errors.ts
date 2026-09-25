import type { z } from 'zod';

/**
 * Maps a schema failure to one friendly message per field. Zod's own messages are for developers;
 * forms show the copy passed in `messages`.
 */
export function fieldErrors<TField extends string>(
    error: z.ZodError,
    messages: Record<TField, string>,
): Partial<Record<TField, string>> {
    const errors: Partial<Record<TField, string>> = {};
    for (const issue of error.issues) {
        const field = String(issue.path[0]) as TField;
        if (field in messages) {
            errors[field] = messages[field];
        }
    }
    return errors;
}
