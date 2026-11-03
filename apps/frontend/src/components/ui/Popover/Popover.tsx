'use client';

import { Popover as MantinePopover } from '@mantine/core';
import clsx from 'clsx';
import type { ReactNode } from 'react';

import styles from './Popover.module.scss';

const POPOVER_WIDTHS = {
    default: '380px',
    invites: '344px',
    rating: '336px',
    watchlist: '336px',
    participants: '260px',
};
const DETAILS_EDGE_GAP = 20;

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
    variant?:
        | 'default'
        | 'invites'
        | 'rating'
        | 'review'
        | 'selection'
        | 'watchlist'
        | 'participants';
}) {
    let position: 'top-end' | 'bottom-end' | 'bottom-start' = 'top-end';
    if (variant === 'watchlist' || variant === 'selection') position = 'bottom-end';
    else if (variant === 'participants') position = 'bottom-start';
    const isDetails = variant === 'review' || variant === 'selection';
    const width = isDetails
        ? 'var(--details-popover-width)'
        : `min(${POPOVER_WIDTHS[variant]}, calc(100vw - var(--gap-md) * 2))`;

    return (
        <MantinePopover
            id={id}
            floatingStrategy="fixed"
            // The invite ticket opens while it may still be sliding in from the screen edge.
            hideDetached={false}
            // The invite ticket sits at the screen's foot, so its panel always opens above it.
            middlewares={{
                flip: variant !== 'invites',
                shift: isDetails ? { padding: DETAILS_EDGE_GAP } : true,
            }}
            width={width}
            opened={open}
            onChange={onChange}
            position={position}
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
