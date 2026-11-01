'use client';

import {
    TextInput as MantineTextInput,
    type TextInputProps as IMantineTextInputProps,
} from '@mantine/core';
import type { ReactNode } from 'react';

import styles from '#components/ui/Field/Field.module.scss';
import type { IFieldProps } from '#components/ui/Field/field.types';
import { FIELD_CLASS_NAMES, getFieldProps } from '#components/ui/Field/field-props';
import type { TOmitStyling } from '#components/ui/types';

export interface ITextInputProps
    extends IFieldProps, TOmitStyling<IMantineTextInputProps, keyof IFieldProps | 'description'> {
    /** Suggestions anchored to the control, above the field's help/error row. */
    dropdown?: ReactNode;
}

export default function TextInput({
    error,
    hint,
    label,
    labelHint,
    success,
    dropdown,
    ...props
}: ITextInputProps) {
    return (
        <MantineTextInput
            {...props}
            {...getFieldProps({ error, hint, label, labelHint, success, dropdown })}
            classNames={{ ...FIELD_CLASS_NAMES, input: styles.control }}
        />
    );
}
