import { z } from 'zod';

// Tab and newline are the only control characters user text may contain (C0, DEL and C1 are not).
const UNSAFE_CONTROL = /(?![\t\n])\p{Cc}/u;
const isSafeText = (value: string): boolean => !UNSAFE_CONTROL.test(value);
// Unicode line and paragraph separators break a line as surely as a newline does.
const LINE_BREAK = /[\r\n\u2028\u2029]/u;

/** Trimmed single-line text such as a name. */
export function singleLineText(min: number, max: number) {
    return z
        .string()
        .trim()
        .min(min)
        .max(max)
        .refine(
            (value) => isSafeText(value) && !LINE_BREAK.test(value),
            'Use a single line of text.',
        );
}

/** Trimmed multi-line text with normalised line endings, such as a message. */
export function multilineText(min: number, max: number) {
    return z
        .string()
        .transform((value) => value.replace(/\r\n?/gu, '\n').trim())
        .pipe(z.string().min(min).max(max).refine(isSafeText, 'Remove control characters.'));
}

/** An optional form field where an empty string means "not provided". */
export function optionalText<TSchema extends z.ZodType<string | undefined>>(schema: TSchema) {
    return z.preprocess(
        (value) => (value === '' || value === null ? undefined : value),
        schema.optional(),
    );
}
