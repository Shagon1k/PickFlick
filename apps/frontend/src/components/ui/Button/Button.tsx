'use client';

import { Button as MantineButton, type ButtonProps as IMantineButtonProps } from '@mantine/core';
import clsx from 'clsx';
import { type ButtonHTMLAttributes, type Ref, useEffect, useState } from 'react';

import Icon from '#components/ui/Icon/Icon';
import type { TOmitStyling } from '#components/ui/types';

import styles from './Button.module.scss';

export type TButtonVariant =
    | 'primary'
    | 'secondary'
    | 'ghost'
    | 'subtle'
    | 'navigation'
    | 'secondary-danger'
    | 'danger'
    | 'cell'
    | 'cell-danger';
export type TButtonSize = 'default' | 'small' | 'large' | 'icon';

export interface IButtonProps
    extends
        TOmitStyling<IMantineButtonProps, 'variant' | 'size' | 'loading'>,
        Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'style' | 'color'> {
    ref?: Ref<HTMLButtonElement>;
    variant?: TButtonVariant;
    size?: TButtonSize;
    loading?: boolean;
    /** Short confirmation shown temporarily in place of the action label and announced. */
    success?: string;
}

const SUCCESS_DURATION_MS = 1800;

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
    const [feedback, setFeedback] = useState({
        success,
        loading,
        isVisible: Boolean(success) && !loading,
    });
    if (feedback.success !== success || feedback.loading !== loading) {
        setFeedback({ success, loading, isVisible: Boolean(success) && !loading });
    }
    const isSuccessVisible = feedback.isVisible;
    useEffect(() => {
        if (!success || loading) return;
        const timer = setTimeout(
            () => setFeedback((current) => ({ ...current, isVisible: false })),
            SUCCESS_DURATION_MS,
        );
        return () => clearTimeout(timer);
    }, [success, loading]);
    return (
        <>
            <MantineButton
                {...props}
                aria-busy={loading || undefined}
                classNames={{
                    root: getButtonClassName(variant, size),
                    inner: styles.button__inner,
                    label: styles.button__label,
                }}
                data-state={getButtonState(isSuccessVisible ? success : undefined, loading)}
                disabled={disabled || loading}
                leftSection={
                    loading ? <span aria-hidden="true" className={styles.spinner} /> : undefined
                }
                type={type}
                unstyled
            >
                <span className={styles.button__original}>{children}</span>
                <span aria-hidden="true" className={styles.button__confirmation}>
                    <Icon name="check" />
                    {success}
                </span>
            </MantineButton>
            {success !== undefined ? (
                <span
                    aria-atomic="true"
                    aria-live="polite"
                    className="visually-hidden"
                    role="status"
                >
                    {isSuccessVisible ? success : ''}
                </span>
            ) : null}
        </>
    );
}
