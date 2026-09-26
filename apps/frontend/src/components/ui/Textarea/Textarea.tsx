'use client';

import {
    Textarea as MantineTextarea,
    type TextareaProps as IMantineTextareaProps,
} from '@mantine/core';
import clsx from 'clsx';

import styles from '@/components/ui/Field/Field.module.scss';
import { fieldState, type IFieldProps } from '@/components/ui/Field/field.types';
import FieldAnnouncements from '@/components/ui/Field/FieldAnnouncements';
import FieldLabel from '@/components/ui/Field/FieldLabel';
import FieldMessage from '@/components/ui/Field/FieldMessage';
import type { TOmitStyling } from '@/components/ui/types';

export interface ITextareaProps
    extends
        IFieldProps,
        TOmitStyling<IMantineTextareaProps, keyof IFieldProps | 'description' | 'size'> {
    /** Shows "length/maxLength" in the message line while there is no error or success. */
    showCount?: boolean;
    size?: 'compact' | 'default' | 'large';
}

export default function Textarea({
    error,
    hint,
    label,
    labelHint,
    maxLength,
    showCount = false,
    size = 'default',
    success,
    ...props
}: ITextareaProps) {
    const count =
        showCount && maxLength ? `${String(props.value ?? '').length}/${maxLength}` : undefined;
    return (
        <MantineTextarea
            {...props}
            classNames={{
                root: styles.field,
                label: styles.field__label,
                input: clsx(
                    styles.control,
                    styles['m-textarea'],
                    size !== 'default' && styles[`m-${size}`],
                ),
                description: styles.field__description,
            }}
            data-state={fieldState(error, success)}
            description={
                <FieldMessage
                    alignEnd={showCount}
                    error={error}
                    hint={count ?? hint}
                    success={success}
                />
            }
            error={Boolean(error)}
            inputContainer={(input) => (
                <>
                    {input}
                    <FieldAnnouncements error={error} success={success} />
                </>
            )}
            inputWrapperOrder={['label', 'input', 'description']}
            label={<FieldLabel hint={labelHint} label={label} />}
            maxLength={maxLength}
            unstyled
            withAsterisk={false}
        />
    );
}
