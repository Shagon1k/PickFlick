'use client';

import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

import Icon from '#components/ui/Icon/Icon';

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
const EDGE_GAP_PX = 8;

export default function InfoTip({ children, label }: IInfoTipProps) {
    const tipId = useId();
    const rootRef = useRef<HTMLSpanElement>(null);
    const bubbleRef = useRef<HTMLSpanElement>(null);
    const [isOpen, setIsOpen] = useState(false);

    // A centred bubble beside a viewport edge slides inward instead of spilling out.
    useLayoutEffect(() => {
        const bubble = bubbleRef.current;
        if (!isOpen || !bubble) return;
        bubble.style.removeProperty('--tip-shift');
        const { left, right } = bubble.getBoundingClientRect();
        const limit = document.documentElement.clientWidth - EDGE_GAP_PX;
        const shift = Math.max(EDGE_GAP_PX - left, 0) - Math.max(right - limit, 0);
        bubble.style.setProperty('--tip-shift', `${shift}px`);
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) {
            return;
        }
        const closeOnEscape = (event: globalThis.KeyboardEvent) => {
            if (event.key === 'Escape') {
                setIsOpen(false);
            }
        };
        const closeOnOutsidePointer = (event: PointerEvent) => {
            if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('keydown', closeOnEscape);
        document.addEventListener('pointerdown', closeOnOutsidePointer);
        return () => {
            document.removeEventListener('keydown', closeOnEscape);
            document.removeEventListener('pointerdown', closeOnOutsidePointer);
        };
    }, [isOpen]);

    return (
        <span
            className={styles.infoTip}
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
            ref={rootRef}
        >
            <button
                aria-describedby={tipId}
                aria-expanded={isOpen}
                aria-label={label}
                className={styles.infoTip__trigger}
                onBlur={() => setIsOpen(false)}
                onClick={() => setIsOpen(true)}
                onFocus={() => setIsOpen(true)}
                type="button"
            >
                <Icon className={styles.infoTip__icon} name="question" />
            </button>
            <span
                className={styles.infoTip__bubble}
                data-open={isOpen || undefined}
                id={tipId}
                ref={bubbleRef}
                role="tooltip"
            >
                {children}
            </span>
        </span>
    );
}
