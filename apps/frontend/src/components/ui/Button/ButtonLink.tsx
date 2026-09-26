'use client';

import { Button as MantineButton } from '@mantine/core';
import Link from 'next/link';
import type { AnchorHTMLAttributes } from 'react';

import { buttonClassName, type TButtonSize, type TButtonVariant } from './Button';
import styles from './Button.module.scss';

export interface IButtonLinkProps extends Omit<
    AnchorHTMLAttributes<HTMLAnchorElement>,
    'className' | 'style' | 'color'
> {
    variant?: Exclude<TButtonVariant, 'danger'>;
    size?: TButtonSize;
    disabled?: boolean;
}

export default function ButtonLink({
    children,
    disabled = false,
    href,
    onClick,
    size = 'default',
    tabIndex,
    variant = 'secondary',
    ...props
}: IButtonLinkProps) {
    return (
        <MantineButton
            {...props}
            aria-disabled={disabled || undefined}
            classNames={{ root: buttonClassName(variant, size), label: styles.button__label }}
            component="a"
            href={disabled ? undefined : href}
            onClick={disabled ? (event) => event.preventDefault() : onClick}
            tabIndex={disabled ? -1 : tabIndex}
            // Enabled links navigate client-side; a disabled one has no href, which Link requires.
            renderRoot={
                disabled || href === undefined
                    ? undefined
                    : (rootProps) => <Link {...rootProps} href={href} />
            }
            unstyled
        >
            {children}
        </MantineButton>
    );
}
