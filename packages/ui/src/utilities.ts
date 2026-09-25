export type FeedbackTone = 'neutral' | 'success' | 'warning' | 'danger';

export function classes(...values: Array<string | false | null | undefined>): string {
    return values.filter(Boolean).join(' ');
}

export function descriptionIds(...values: Array<string | undefined>): string | undefined {
    return values.filter(Boolean).join(' ') || undefined;
}

/** Drops undefined entries, which exactOptionalPropertyTypes forbids passing explicitly. */
export function definedProps<Props extends Record<string, unknown>>(
    props: Props,
): { [Key in keyof Props]?: Exclude<Props[Key], undefined> } {
    return Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined)) as {
        [Key in keyof Props]?: Exclude<Props[Key], undefined>;
    };
}
