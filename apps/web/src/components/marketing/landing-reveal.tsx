'use client';

import { useEffect, useRef, type ReactNode } from 'react';

import styles from './marketing.module.css';

export function LandingRevealRoot({ children }: Readonly<{ children: ReactNode }>) {
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const root = rootRef.current;

        if (!root) {
            return;
        }

        const revealClass = styles.reveal;
        const revealedClass = styles.revealed;

        if (!revealClass || !revealedClass) {
            return;
        }

        const sections = [...root.querySelectorAll<HTMLElement>(`.${revealClass}`)];
        const reveal = (section: HTMLElement) => section.classList.add(revealedClass);

        if (globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            return;
        }

        if (!('IntersectionObserver' in globalThis)) {
            return;
        }

        root.dataset.reveal = 'enabled';

        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        reveal(entry.target as HTMLElement);
                        observer.unobserve(entry.target);
                    }
                }
            },
            { threshold: 0.15 },
        );

        sections.forEach((section) => observer.observe(section));

        return () => {
            observer.disconnect();
            delete root.dataset.reveal;
        };
    }, []);

    return (
        <div className={styles.page} ref={rootRef}>
            {children}
        </div>
    );
}
