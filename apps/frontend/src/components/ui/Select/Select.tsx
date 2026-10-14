'use client';

import { Select as MantineSelect, type SelectProps as IMantineSelectProps } from '@mantine/core';
import clsx from 'clsx';
import { useRef, useState } from 'react';

import fieldStyles from '@/components/ui/Field/Field.module.scss';
import { getFieldState, type IFieldProps } from '@/components/ui/Field/field.types';
import FieldAnnouncements from '@/components/ui/Field/FieldAnnouncements';
import FieldLabel from '@/components/ui/Field/FieldLabel';
import FieldMessage from '@/components/ui/Field/FieldMessage';
import type { TOmitStyling } from '@/components/ui/types';

import styles from './Select.module.scss';

const DROPDOWN_FADE_MS = 150;

export interface ISelectProps
    extends
        IFieldProps,
        TOmitStyling<IMantineSelectProps, keyof IFieldProps | 'description' | 'hiddenInputProps'> {}

export default function Select({
    disabled,
    error,
    hint,
    label,
    labelHint,
    onChange,
    readOnly,
    required,
    success,
    value,
    ...props
}: ISelectProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    // Mantine's combobox is not a native control, so a hidden required input carries the
    // browser's form constraint and reports a failed submit back to the visible field.
    const [hasConstraintFailed, setHasConstraintFailed] = useState(false);
    const isConstrained = Boolean(required) && !readOnly;
    if (hasConstraintFailed && (!isConstrained || disabled || value)) {
        setHasConstraintFailed(false);
    }
    const isInvalid = Boolean(error) || hasConstraintFailed;

    return (
        <MantineSelect
            {...props}
            allowDeselect={false}
            classNames={{
                root: fieldStyles.field,
                label: fieldStyles.field__label,
                input: clsx(fieldStyles.control, fieldStyles['m-select']),
                description: fieldStyles.field__description,
                dropdown: styles.select__dropdown,
                option: styles.select__option,
                section: styles.select__section,
                wrapper: styles.select__wrapper,
            }}
            comboboxProps={{ transitionProps: { duration: DROPDOWN_FADE_MS } }}
            data-state={isInvalid ? 'error' : getFieldState(error, success)}
            description={<FieldMessage error={error} hint={hint} success={success} />}
            disabled={disabled}
            error={isInvalid}
            hiddenInputProps={
                isConstrained
                    ? {
                          'aria-hidden': true,
                          className: 'visually-hidden',
                          onInvalid: (event) => {
                              event.preventDefault();
                              setHasConstraintFailed(true);
                              inputRef.current?.focus();
                          },
                          required: true,
                          tabIndex: -1,
                          type: 'text',
                      }
                    : undefined
            }
            inputContainer={(input) => (
                <>
                    {input}
                    <FieldAnnouncements error={error} success={success} />
                </>
            )}
            inputWrapperOrder={['label', 'input', 'description']}
            label={<FieldLabel hint={labelHint} label={label} />}
            onChange={(nextValue, option) => {
                setHasConstraintFailed(false);
                onChange?.(nextValue, option);
            }}
            readOnly={readOnly}
            ref={inputRef}
            required={isConstrained}
            unstyled
            value={value}
            withAsterisk={false}
            withCheckIcon={false}
        />
    );
}
