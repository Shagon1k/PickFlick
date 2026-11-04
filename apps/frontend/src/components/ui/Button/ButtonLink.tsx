'use client';

import { Button as MantineButton } from '@mantine/core';
import Link, { type LinkProps as TNextLinkProps } from 'next/link';
import type { AnchorHTMLAttributes } from 'react';

import { getButtonClassName, type TButtonSize, type TButtonVariant } from './Button';
import styles from './Button.module.scss';

export interface IButtonLinkProps extends Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'className' | 'style' | 'color'
> {
    variant?: Exclude<TButtonVariant, 'danger'>;
    size?: TButtonSize;
    disabled?: boolean;
    fullWidth?: boolean;
    onNavigate?: TNextLinkProps['onNavigate'];
}

export default function ButtonLink({
    children,
    disabled = false,
    href,
    onClick,
    onNavigate,
    size = 'default',
    tabIndex,
    variant = 'secondary',
    ...props
}: IButtonLinkProps) {
    return (
        <MantineButton
            {...props}
            aria-disabled={disabled || undefined}
            classNames={{
                root: getButtonClassName(variant, size),
                inner: styles.button__inner,
                label: styles.button__label,
            }}
            component="a"
            data-press-feedback
            href={disabled ? undefined : href}
            onClick={disabled ? (event) => event.preventDefault() : onClick}
            tabIndex={disabled ? -1 : tabIndex}
            // Enabled links navigate client-side; a disabled one has no href, which Link requires.
            renderRoot={
                disabled || href === undefined
                    ? undefined
                    : (rootProps) => <Link {...rootProps} href={href} onNavigate={onNavigate} />
            }
            unstyled
        >
            {children}
        </MantineButton>
    );
}
