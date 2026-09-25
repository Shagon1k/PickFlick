export type FormFeedbackTone = 'neutral' | 'success' | 'danger' | 'warning';

export interface FormActionState<FieldName extends string> {
    readonly revision: number;
    readonly status: 'idle' | 'success' | 'error';
    readonly message: string;
    readonly tone: FormFeedbackTone;
    readonly fieldErrors?: Partial<Record<FieldName, string>>;
}

export type FormServerAction<FieldName extends string> = (
    previous: FormActionState<FieldName>,
    formData: FormData,
) => Promise<FormActionState<FieldName>>;

export function initialFormActionState<FieldName extends string>(): FormActionState<FieldName> {
    return { revision: 0, status: 'idle', message: '', tone: 'neutral' };
}
