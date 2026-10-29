import type { ReactNode } from 'react';

import styles from '#components/ui/Field/Field.module.scss';
import { getFieldState, type IFieldProps } from '#components/ui/Field/field.types';
import FieldAnnouncements from '#components/ui/Field/FieldAnnouncements';
import FieldLabel from '#components/ui/Field/FieldLabel';
import FieldMessage from '#components/ui/Field/FieldMessage';

type TFieldSlot = 'label' | 'input' | 'description';
const SLOT_ORDER: TFieldSlot[] = ['label', 'input', 'description'];

/**
 * The Mantine props every labelled field shares: label with its hint, the message below the
 * control, live announcements of errors and success, and the slot order. Each field adds its
 * own `classNames.input` and anything specific to its control.
 */
export function getFieldProps({
    error,
    hint,
    label,
    labelHint,
    success,
    message = <FieldMessage error={error} hint={hint} success={success} />,
}: Omit<IFieldProps, 'id'> & { message?: ReactNode }) {
    return {
        'data-state': getFieldState(error, success),
        description: message,
        error: Boolean(error),
        inputContainer: (input: ReactNode) => (
            <>
                {input}
                <FieldAnnouncements error={error} success={success} />
            </>
        ),
        inputWrapperOrder: SLOT_ORDER,
        label: <FieldLabel hint={labelHint} label={label} />,
        unstyled: true,
        withAsterisk: false,
    };
}

export const FIELD_CLASS_NAMES = {
    root: styles.field,
    label: styles.field__label,
    description: styles.field__description,
};
