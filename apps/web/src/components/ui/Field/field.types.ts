import type { ReactNode } from 'react';

/** Props every labelled form field shares. */
export interface IFieldProps {
    id: string;
    label: string;
    /** Quiet qualifier rendered inside the label, such as "required" or "optional". */
    labelHint?: string;
    error?: ReactNode;
    hint?: string;
    success?: string;
}

export function fieldState(error?: ReactNode, success?: string): 'error' | 'success' | undefined {
    if (error) {
        return 'error';
    }
    return success ? 'success' : undefined;
}
