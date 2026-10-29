'use client';

import {
    Textarea as MantineTextarea,
    type TextareaProps as IMantineTextareaProps,
} from '@mantine/core';
import clsx from 'clsx';

import styles from '#components/ui/Field/Field.module.scss';
import type { IFieldProps } from '#components/ui/Field/field.types';
import { FIELD_CLASS_NAMES, getFieldProps } from '#components/ui/Field/field-props';
import FieldMessage from '#components/ui/Field/FieldMessage';
import type { TOmitStyling } from '#components/ui/types';

export interface ITextareaProps
    extends
        IFieldProps,
        TOmitStyling<IMantineTextareaProps, keyof IFieldProps | 'description' | 'size'> {
    /** Shows "length/maxLength" in the message line while there is no error or success. */
    shouldShowCount?: boolean;
    size?: 'compact' | 'default' | 'large';
}

export default function Textarea({
    error,
    hint,
    label,
    labelHint,
    maxLength,
    shouldShowCount = false,
    size = 'default',
    success,
    ...props
}: ITextareaProps) {
    const count =
        shouldShowCount && maxLength
            ? `${String(props.value ?? '').length}/${maxLength}`
            : undefined;
    return (
        <MantineTextarea
            {...props}
            {...getFieldProps({
                error,
                label,
                labelHint,
                success,
                message: (
                    <FieldMessage
                        shouldAlignEnd={shouldShowCount}
                        error={error}
                        hint={count ?? hint}
                        success={success}
                    />
                ),
            })}
            classNames={{
                ...FIELD_CLASS_NAMES,
                input: clsx(
                    styles.control,
                    styles['m-textarea'],
                    size !== 'default' && styles[`m-${size}`],
                ),
            }}
            maxLength={maxLength}
        />
    );
}
