import { z } from 'zod';

// Tab and newline are the only control characters user text may contain.
const safeText = (value: string): boolean =>
    [...value].every((character) => {
        const code = character.codePointAt(0) ?? 0;
        return code === 9 || code === 10 || (code >= 32 && code !== 127);
    });

/** Trimmed single-line text such as a name. */
export function singleLineText(min: number, max: number) {
    return z
        .string()
        .trim()
        .min(min)
        .max(max)
        .refine((value) => safeText(value) && !/[\r\n]/u.test(value), 'Use a single line of text.');
}

/** Trimmed multi-line text with normalised line endings, such as a message. */
export function multilineText(min: number, max: number) {
    return z
        .string()
        .transform((value) => value.replace(/\r\n?/gu, '\n').trim())
        .pipe(z.string().min(min).max(max).refine(safeText, 'Remove control characters.'));
}

/** An optional form field where an empty string means "not provided". */
export function optionalText<TSchema extends z.ZodType<string | undefined>>(schema: TSchema) {
    return z.preprocess(
        (value) => (value === '' || value === null ? undefined : value),
        schema.optional(),
    );
}
