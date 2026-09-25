export interface IContactFormValues {
    message: string;
    name: string;
    email: string;
}

export type TContactFieldName = keyof IContactFormValues;
export type TContactFieldErrors = Partial<Record<TContactFieldName, string>>;
