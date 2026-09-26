/** A form field's text value; a missing field or an uploaded file reads as an empty string. */
export function formText(formData: FormData, name: string): string {
    const value = formData.get(name);
    return typeof value === 'string' ? value : '';
}
