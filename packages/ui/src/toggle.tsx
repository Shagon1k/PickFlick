import type { InputHTMLAttributes } from 'react';

import { classes, descriptionIds } from './utilities.js';

export interface ToggleProps extends Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'className' | 'type'
> {
    readonly label: string;
    readonly description?: string;
    readonly className?: string;
}

export function Toggle({
    'aria-describedby': ariaDescribedBy,
    'aria-labelledby': ariaLabelledBy,
    className,
    description,
    id,
    label,
    ...props
}: ToggleProps) {
    const descriptionId = id && description ? `${id}-description` : undefined;
    const labelId = id ? `${id}-label` : undefined;
    const labelledBy = descriptionIds(ariaLabelledBy, labelId);

    return (
        <label className={classes('pf-toggle', className)} htmlFor={id}>
            <span className="pf-toggle__copy">
                <span className="pf-toggle__label" id={labelId}>
                    {label}
                </span>
                {description ? (
                    <span className="pf-toggle__description" id={descriptionId}>
                        {description}
                    </span>
                ) : null}
            </span>
            <span className="pf-toggle__track">
                <input
                    {...props}
                    aria-describedby={descriptionIds(ariaDescribedBy, descriptionId)}
                    aria-label={labelledBy ? undefined : label}
                    aria-labelledby={labelledBy}
                    id={id}
                    type="checkbox"
                />
                <span aria-hidden="true" className="pf-toggle__thumb" />
            </span>
        </label>
    );
}
