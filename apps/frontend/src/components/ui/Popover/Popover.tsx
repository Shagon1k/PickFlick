'use client';

import { Popover as MantinePopover } from '@mantine/core';
import clsx from 'clsx';
import type { ReactNode } from 'react';

import styles from './Popover.module.scss';

const POPOVER_WIDTHS = { default: '380px', invites: '344px', rating: '560px' };

export default function Popover({
    children,
    trigger,
    open,
    onChange,
    label,
    id,
    variant = 'default',
}: {
    children: ReactNode;
    trigger: ReactNode;
    open: boolean;
    onChange: (open: boolean) => void;
    label: string;
    id: string;
    variant?: 'default' | 'invites' | 'rating';
}) {
    return (
        <MantinePopover
            id={id}
            floatingStrategy="fixed"
            width={`min(${POPOVER_WIDTHS[variant]}, calc(100vw - var(--gap-md) * 2))`}
            opened={open}
            onChange={onChange}
            position="top-end"
            returnFocus
            trapFocus
            withinPortal
            unstyled
        >
            <MantinePopover.Target>{trigger}</MantinePopover.Target>
            <MantinePopover.Dropdown
                aria-label={label}
                className={clsx(styles.popover, styles[`m-${variant}`])}
                role="dialog"
            >
                {children}
            </MantinePopover.Dropdown>
        </MantinePopover>
    );
}
