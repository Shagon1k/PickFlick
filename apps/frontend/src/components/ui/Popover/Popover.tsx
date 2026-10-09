'use client';

import { Popover as MantinePopover } from '@mantine/core';
import type { ReactNode } from 'react';

import styles from './Popover.module.scss';

export default function Popover({
    children,
    trigger,
    open,
    onChange,
    label,
    id,
}: {
    children: ReactNode;
    trigger: ReactNode;
    open: boolean;
    onChange: (open: boolean) => void;
    label: string;
    id: string;
}) {
    return (
        <MantinePopover
            id={id}
            floatingStrategy="fixed"
            width="min(380px, calc(100vw - var(--gap-md) * 2))"
            opened={open}
            onChange={onChange}
            position="top-end"
            returnFocus
            trapFocus
            withinPortal
            unstyled
        >
            <MantinePopover.Target>{trigger}</MantinePopover.Target>
            <MantinePopover.Dropdown aria-label={label} className={styles.popover} role="dialog">
                {children}
            </MantinePopover.Dropdown>
        </MantinePopover>
    );
}
