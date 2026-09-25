'use client';

import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

import Icon from '@/components/ui/Icon/Icon';

import styles from './InfoTip.module.scss';

export interface IInfoTipProps {
    /** Accessible name for the trigger, such as "About the Selection score range". */
    label: string;
    children: ReactNode;
}

/**
 * A quiet "?" trigger that reveals a short explanation on hover, keyboard focus, or tap.
 * The explanation stays in the DOM as the trigger's accessible description.
 */
export default function InfoTip({ children, label }: IInfoTipProps) {
    const tipId = useId();
    const rootRef = useRef<HTMLSpanElement>(null);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!open) {
            return;
        }
        const closeOnEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') {
                setOpen(false);
            }
        };
        const closeOnOutsidePointer = (event: PointerEvent) => {
            if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
                setOpen(false);
            }
        };
        document.addEventListener('keydown', closeOnEscape);
        document.addEventListener('pointerdown', closeOnOutsidePointer);
        return () => {
            document.removeEventListener('keydown', closeOnEscape);
            document.removeEventListener('pointerdown', closeOnOutsidePointer);
        };
    }, [open]);

    return (
        <span
            className={styles['info-tip']}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            ref={rootRef}
        >
            <button
                aria-describedby={tipId}
                aria-expanded={open}
                aria-label={label}
                className={styles['info-tip__trigger']}
                onBlur={() => setOpen(false)}
                onClick={() => setOpen(true)}
                onFocus={() => setOpen(true)}
                type="button"
            >
                <Icon className={styles['info-tip__icon']} name="question" />
            </button>
            <span
                className={styles['info-tip__bubble']}
                data-open={open || undefined}
                id={tipId}
                role="tooltip"
            >
                {children}
            </span>
        </span>
    );
}
