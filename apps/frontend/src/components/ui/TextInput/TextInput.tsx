'use client';

import {
    TextInput as MantineTextInput,
    type TextInputProps as IMantineTextInputProps,
} from '@mantine/core';

import styles from '@/components/ui/Field/Field.module.scss';
import { fieldState, type IFieldProps } from '@/components/ui/Field/field.types';
import FieldAnnouncements from '@/components/ui/Field/FieldAnnouncements';
import FieldLabel from '@/components/ui/Field/FieldLabel';
import FieldMessage from '@/components/ui/Field/FieldMessage';
import type { TOmitStyling } from '@/components/ui/types';

export interface ITextInputProps
    extends IFieldProps, TOmitStyling<IMantineTextInputProps, keyof IFieldProps | 'description'> {}

export default function TextInput({
    error,
    hint,
    label,
    labelHint,
    success,
    ...props
}: ITextInputProps) {
    return (
        <MantineTextInput
            {...props}
            classNames={{
                root: styles.field,
                label: styles.field__label,
                input: styles.control,
                description: styles.field__description,
            }}
            data-state={fieldState(error, success)}
            description={<FieldMessage error={error} hint={hint} success={success} />}
            error={Boolean(error)}
            inputContainer={(input) => (
                <>
                    {input}
                    <FieldAnnouncements error={error} success={success} />
                </>
            )}
            inputWrapperOrder={['label', 'input', 'description']}
            label={<FieldLabel hint={labelHint} label={label} />}
            unstyled
            withAsterisk={false}
        />
    );
}
