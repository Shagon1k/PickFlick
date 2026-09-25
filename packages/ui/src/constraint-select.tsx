'use client';

import { Select as MantineSelect, type SelectProps as MantineSelectProps } from '@mantine/core';
import { useRef, useState } from 'react';

import { definedProps } from './utilities.js';

export interface ConstraintSelectProps extends Omit<
    MantineSelectProps<string>,
    'hiddenInputProps' | 'onChange'
> {
    readonly 'data-state'?: string | undefined;
    readonly onChange?: (value: string | null) => void;
}

type AriaInvalid = ConstraintSelectProps['aria-invalid'];

function isAriaInvalid(value: AriaInvalid): boolean {
    return value !== undefined && value !== false && value !== 'false';
}

export function ConstraintSelect({
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    attributes,
    disabled,
    error,
    id,
    onChange,
    readOnly,
    required,
    value,
    ...props
}: ConstraintSelectProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [constraintInvalid, setConstraintInvalid] = useState(false);
    const constraintError = constraintInvalid && !readOnly;
    const effectiveRequired = required && !readOnly;
    const dataState = props['data-state'] ?? (constraintError ? 'error' : undefined);
    const flaggedInvalid = constraintError || Boolean(error);
    const invalid = flaggedInvalid || isAriaInvalid(ariaInvalid);
    const renderedAriaInvalid = flaggedInvalid ? true : ariaInvalid;
    const constraintInputProps: MantineSelectProps<string>['hiddenInputProps'] = {
        'aria-hidden': true,
        className: 'pf-visually-hidden',
        onInvalid: (event) => {
            event.preventDefault();
            setConstraintInvalid(true);
            inputRef.current?.focus();
        },
        required: true,
        tabIndex: -1,
        type: 'text',
    };

    // A satisfied or lifted constraint clears the flag during render rather than in an effect.
    if (constraintInvalid && (!effectiveRequired || disabled || value)) {
        setConstraintInvalid(false);
    }

    return (
        <MantineSelect
            {...props}
            attributes={{
                ...attributes,
                input: {
                    ...attributes?.input,
                    ...definedProps({
                        'aria-describedby': ariaDescribedBy,
                        'aria-invalid': renderedAriaInvalid,
                        id,
                    }),
                },
            }}
            {...definedProps({ 'data-state': dataState, disabled, readOnly, value })}
            {...(invalid ? { error: true } : {})}
            {...(effectiveRequired
                ? { hiddenInputProps: constraintInputProps, required: true }
                : {})}
            onChange={(nextValue) => {
                setConstraintInvalid(false);
                onChange?.(nextValue);
            }}
            id={id}
            ref={inputRef}
        />
    );
}
