import { Children, isValidElement, type AriaAttributes, type ReactNode } from 'react';

import { ConstraintSelect } from './constraint-select.js';
import { controlState, FieldLabel, FieldMessage, type SharedFieldProps } from './fields.js';
import { classes, descriptionIds } from './utilities.js';

interface SelectOptionProps {
    readonly children?: ReactNode;
    readonly disabled?: boolean;
    readonly value?: string | number | readonly string[];
}

function selectData(
    children: ReactNode,
): Array<{ value: string; label: string; disabled?: boolean }> {
    // SelectField mirrors the native <select> API, so its <option> children become Mantine data.
    // eslint-disable-next-line @eslint-react/no-children-to-array
    return Children.toArray(children).flatMap((child) => {
        if (!isValidElement<SelectOptionProps>(child) || child.type !== 'option') {
            return [];
        }
        const value = String(child.props.value ?? child.props.children ?? '');
        const label =
            typeof child.props.children === 'string' || typeof child.props.children === 'number'
                ? String(child.props.children)
                : value;
        return [{ value, label, ...(child.props.disabled ? { disabled: true } : {}) }];
    });
}

export interface SelectFieldProps extends SharedFieldProps {
    readonly children?: ReactNode;
    readonly value?: string | null;
    readonly defaultValue?: string | null;
    readonly onChange?: (value: string | null) => void;
    readonly name?: string;
    readonly placeholder?: string;
    readonly disabled?: boolean;
    readonly required?: boolean;
    readonly readOnly?: boolean;
    readonly autoFocus?: boolean;
    readonly form?: string;
    readonly 'aria-describedby'?: string;
    readonly 'aria-invalid'?: AriaAttributes['aria-invalid'];
}

export function SelectField({
    'aria-describedby': ariaDescribedBy,
    'aria-invalid': ariaInvalid,
    autoFocus,
    children,
    className,
    disabled,
    error,
    form,
    hint,
    id,
    label,
    labelHint,
    name,
    onChange,
    placeholder,
    readOnly,
    required,
    success,
    value,
    defaultValue,
}: SelectFieldProps) {
    const messageId = `${id}-message`;
    const hasMessage = Boolean(error ?? success ?? hint);

    return (
        <div className={classes('pf-field', className)}>
            <FieldLabel hint={labelHint} htmlFor={id} label={label} />
            <ConstraintSelect
                allowDeselect={false}
                aria-describedby={descriptionIds(
                    ariaDescribedBy,
                    hasMessage ? messageId : undefined,
                )}
                aria-invalid={ariaInvalid ?? (error ? true : undefined)}
                classNames={{
                    dropdown: 'pf-select__dropdown',
                    input: 'pf-control pf-control--select',
                    option: 'pf-select__option',
                    root: 'pf-select',
                    section: 'pf-select__section',
                    wrapper: 'pf-select__wrapper',
                }}
                comboboxProps={{ transitionProps: { duration: 150 } }}
                data={selectData(children)}
                data-state={controlState(error, success)}
                id={id}
                unstyled
                withCheckIcon={false}
                {...(autoFocus !== undefined ? { autoFocus } : {})}
                {...(defaultValue !== undefined ? { defaultValue } : {})}
                {...(disabled !== undefined ? { disabled } : {})}
                {...(form !== undefined ? { form } : {})}
                {...(name !== undefined ? { name } : {})}
                {...(onChange ? { onChange } : {})}
                {...(placeholder !== undefined ? { placeholder } : {})}
                {...(readOnly !== undefined ? { readOnly } : {})}
                {...(required !== undefined ? { required } : {})}
                {...(value !== undefined ? { value } : {})}
            />
            <FieldMessage error={error} hint={hint} messageId={messageId} success={success} />
        </div>
    );
}
