'use client';

import { type ReactNode, useEffect, useRef } from 'react';

import styles from '../../marketing.module.scss';

// Reveal a section once 15% of it is on screen.
const REVEAL_THRESHOLD = 0.15;

export default function LandingReveal({ children }: { children: ReactNode }) {
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
            { threshold: REVEAL_THRESHOLD },
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
