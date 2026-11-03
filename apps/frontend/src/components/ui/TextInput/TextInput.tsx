'use client';

import {
    TextInput as MantineTextInput,
    type TextInputProps as IMantineTextInputProps,
} from '@mantine/core';
import clsx from 'clsx';
import type { ReactNode } from 'react';

import styles from '#components/ui/Field/Field.module.scss';
import type { IFieldProps } from '#components/ui/Field/field.types';
import { FIELD_CLASS_NAMES, getFieldProps } from '#components/ui/Field/field-props';
import type { TOmitStyling } from '#components/ui/types';

export interface ITextInputProps
    extends IFieldProps, TOmitStyling<IMantineTextInputProps, keyof IFieldProps | 'description'> {
    /** Suggestions anchored to the control, above the field's help/error row. */
    dropdown?: ReactNode;
    shouldReserveMessage?: boolean;
    variant?: 'default' | 'selected';
}

export default function TextInput({
    error,
    hint,
    isLabelHidden,
    label,
    labelHint,
    success,
    dropdown,
    shouldReserveMessage,
    rightSection,
    variant = 'default',
    ...props
}: ITextInputProps) {
    return (
        <MantineTextInput
            {...props}
            rightSection={rightSection}
            {...getFieldProps({
                error,
                hint,
                isLabelHidden,
                label,
                labelHint,
                success,
                dropdown,
                shouldReserveMessage,
            })}
            classNames={{
                ...FIELD_CLASS_NAMES,
                wrapper: styles['field__control-wrapper'],
                section: styles.field__section,
                input: clsx(
                    styles.control,
                    rightSection && styles['m-end-action'],
                    variant === 'selected' && styles['m-selected'],
                ),
            }}
        />
    );
}
