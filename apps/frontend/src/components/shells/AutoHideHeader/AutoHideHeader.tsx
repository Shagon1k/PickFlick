'use client';

import { type ReactNode, useEffect, useRef } from 'react';

// Small scroll steps (trackpad jitter, momentum ends) should not flip the header.
const SCROLL_STEP_PX = 8;

/**
 * A sticky header that slides away while the page scrolls down and returns on any scroll up. It
 * stays while near the top, while focus is inside it (keyboard users never lose it) and while one
 * of its menus or panels is open.
 */
export default function AutoHideHeader({
    className,
    children,
}: {
    className?: string;
    children: ReactNode;
}) {
    const ref = useRef<HTMLElement>(null);
    useEffect(() => {
        const header = ref.current;
        if (!header) return undefined;
        let lastY = window.scrollY;
        function handleScroll() {
            if (!header) return;
            const scrollY = window.scrollY;
            if (Math.abs(scrollY - lastY) < SCROLL_STEP_PX) return;
            const isEngaged =
                header.matches(':focus-within') ||
                header.querySelector('[aria-expanded="true"]') !== null;
            header.toggleAttribute(
                'data-hidden',
                scrollY > lastY && scrollY > header.offsetHeight && !isEngaged,
            );
            lastY = scrollY;
        }
        function handleFocus() {
            header?.removeAttribute('data-hidden');
        }
        window.addEventListener('scroll', handleScroll, { passive: true });
        header.addEventListener('focusin', handleFocus);
        return () => {
            window.removeEventListener('scroll', handleScroll);
            header.removeEventListener('focusin', handleFocus);
        };
    }, []);
    return (
        <header className={className} ref={ref}>
            {children}
        </header>
    );
}
