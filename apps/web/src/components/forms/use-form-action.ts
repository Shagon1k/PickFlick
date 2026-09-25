'use client';

import { useActionState } from 'react';

import type { FormActionState, FormServerAction } from '@/components/forms/form-action.types';

export function useFormAction<FieldName extends string>(
    action: FormServerAction<FieldName>,
    initialState: FormActionState<FieldName>,
    unavailableMessage: string,
) {
    return useActionState(async (previous: FormActionState<FieldName>, formData: FormData) => {
        try {
            return await action(previous, formData);
        } catch {
            return {
                revision: previous.revision + 1,
                status: 'error' as const,
                message: unavailableMessage,
                tone: 'danger' as const,
            };
        }
    }, initialState);
}
