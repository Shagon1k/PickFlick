import { Button as MantineButton, type ButtonProps as IMantineButtonProps } from '@mantine/core';
import clsx from 'clsx';
import type { ButtonHTMLAttributes } from 'react';

import type { TOmitStyling } from '@/components/ui/types';

import styles from './Button.module.scss';

export type TButtonVariant = 'primary' | 'secondary' | 'ghost' | 'secondary-danger' | 'danger';
export type TButtonSize = 'default' | 'small' | 'large';

export interface IButtonProps
    extends
        TOmitStyling<IMantineButtonProps, 'variant' | 'size' | 'loading'>,
        Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'style' | 'color'> {
    variant?: TButtonVariant;
    size?: TButtonSize;
    loading?: boolean;
    /** Announced politely while the action label stays unchanged. */
    success?: string;
}

function getButtonState(success?: string, isLoading?: boolean): 'success' | 'loading' | undefined {
    if (success) {
        return 'success';
    }
    return isLoading ? 'loading' : undefined;
}

export function getButtonClassName(variant: TButtonVariant, size: TButtonSize): string {
    return clsx(styles.button, styles[`m-${variant}`], size !== 'default' && styles[`m-${size}`]);
}

export default function Button({
    children,
    disabled,
    loading = false,
    size = 'default',
    success,
    type = 'button',
    variant = 'primary',
    ...props
}: IButtonProps) {
    return (
        <>
            <MantineButton
                {...props}
                aria-busy={loading || undefined}
                classNames={{
                    root: getButtonClassName(variant, size),
                    label: styles.button__label,
                }}
                data-state={getButtonState(success, loading)}
                disabled={disabled || loading}
                leftSection={
                    loading ? <span aria-hidden="true" className={styles.spinner} /> : undefined
                }
                type={type}
                unstyled
            >
                {children}
            </MantineButton>
            {success ? (
                <span
                    aria-atomic="true"
                    aria-live="polite"
                    className="visually-hidden"
                    role="status"
                >
                    {success}
                </span>
            ) : null}
        </>
    );
}
