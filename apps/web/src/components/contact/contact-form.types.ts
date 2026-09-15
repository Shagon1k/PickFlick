export interface ContactFormValues {
  readonly message: string;
  readonly name: string;
  readonly email: string;
}

export type ContactFieldName = keyof ContactFormValues;
export type ContactFieldErrors = Partial<Record<ContactFieldName, string>>;
