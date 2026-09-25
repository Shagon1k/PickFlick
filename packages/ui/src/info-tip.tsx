'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { Icon } from './icon.js';

export interface InfoTipProps {
    /** Accessible name for the trigger, such as "About the Selection score range". */
    readonly label: string;
    readonly children: ReactNode;
}

/**
 * A quiet "?" trigger that reveals a short explanation on hover, keyboard focus, or tap.
 * The explanation stays in the DOM as the trigger's accessible description.
 */
export function InfoTip({ children, label }: InfoTipProps) {
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
            className="pf-infotip"
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => setOpen(false)}
            ref={rootRef}
        >
            <button
                aria-describedby={tipId}
                aria-expanded={open}
                aria-label={label}
                className="pf-infotip__trigger"
                onBlur={() => setOpen(false)}
                onClick={() => setOpen(true)}
                onFocus={() => setOpen(true)}
                type="button"
            >
                <Icon className="pf-infotip__icon" name="question" />
            </button>
            <span
                className="pf-infotip__bubble"
                data-open={open || undefined}
                id={tipId}
                role="tooltip"
            >
                {children}
            </span>
        </span>
    );
}
