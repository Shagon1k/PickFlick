import type { ReactNode } from 'react';

/** Props every labelled form field shares. */
export interface IFieldProps {
    id: string;
    label: string;
    /** Quiet qualifier rendered inside the label, such as "required" or "optional". */
    labelHint?: string;
    /** Keeps the label for assistive technology only, where a placeholder names the field. */
    isLabelHidden?: boolean;
    error?: ReactNode;
    hint?: string;
    success?: string;
}

export function getFieldState(
    error?: ReactNode,
    success?: string,
): 'error' | 'success' | undefined {
    if (error) {
        return 'error';
    }
    return success ? 'success' : undefined;
}
