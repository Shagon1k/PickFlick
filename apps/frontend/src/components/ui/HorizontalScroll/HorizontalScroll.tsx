'use client';

import clsx from 'clsx';
import { type ReactNode, useEffect, useRef } from 'react';

import styles from './HorizontalScroll.module.scss';

const EDGE_TOLERANCE_PX = 1;

export default function HorizontalScroll({
    children,
    label,
    variant = 'default',
}: {
    children: ReactNode;
    label: string;
    variant?: 'default' | 'leaderboard' | 'ruled' | 'plain';
}) {
    const frameRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!frameRef.current || !contentRef.current) return;
        const frame = frameRef.current;
        const content = contentRef.current;
        function updateEdges() {
            frame.toggleAttribute('data-scroll-left', content.scrollLeft > EDGE_TOLERANCE_PX);
            frame.toggleAttribute(
                'data-scroll-right',
                content.scrollWidth - content.clientWidth - content.scrollLeft > EDGE_TOLERANCE_PX,
            );
        }
        const observer = new ResizeObserver(updateEdges);
        observer.observe(content);
        if (content.firstElementChild) observer.observe(content.firstElementChild);
        content.addEventListener('scroll', updateEdges, { passive: true });
        updateEdges();
        return () => {
            observer.disconnect();
            content.removeEventListener('scroll', updateEdges);
        };
    }, []);
    return (
        <div className={clsx(styles.horizontalScroll, styles[`m-${variant}`])} ref={frameRef}>
            <div
                aria-label={`${label} scroll region`}
                className={styles.horizontalScroll__content}
                ref={contentRef}
                role="region"
                tabIndex={0}
            >
                {children}
            </div>
            <span
                aria-hidden="true"
                className={clsx(styles.horizontalScroll__edge, styles['m-left'])}
            />
            <span
                aria-hidden="true"
                className={clsx(styles.horizontalScroll__edge, styles['m-right'])}
            />
        </div>
    );
}
