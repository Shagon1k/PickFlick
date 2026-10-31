'use client';

import { type CSSProperties, useEffect, useRef, useState } from 'react';

import styles from './FilmProgress.module.scss';

// About 30px per frame, as in the prototype strip; the count follows the strip's width so frames
// keep their proportions from a phone to a wide card.
const FRAME_WIDTH_PX = 30;
const MIN_FRAMES = 6;
const DEFAULT_FRAMES = 15;
const FULL_PROGRESS = 100;

export default function FilmProgress({
    value,
    max,
    label,
}: {
    value: number;
    max: number;
    label: string;
}) {
    const filmRef = useRef<HTMLDivElement>(null);
    const [frameCount, setFrameCount] = useState(DEFAULT_FRAMES);
    useEffect(() => {
        const film = filmRef.current;
        if (!film) return;
        const observer = new ResizeObserver(([entry]) => {
            if (entry)
                setFrameCount(
                    Math.max(MIN_FRAMES, Math.round(entry.contentRect.width / FRAME_WIDTH_PX)),
                );
        });
        observer.observe(film);
        return () => observer.disconnect();
    }, []);
    const percentage = Math.min(
        FULL_PROGRESS,
        Math.max(0, (value / Math.max(1, max)) * FULL_PROGRESS),
    );
    const filled = Math.round((percentage / FULL_PROGRESS) * frameCount);
    const isRunning = percentage > 0 && percentage < FULL_PROGRESS;
    return (
        <div
            className={styles.film}
            ref={filmRef}
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={FULL_PROGRESS}
            aria-valuenow={percentage}
            style={{ '--frames': frameCount } as CSSProperties}
        >
            {Array.from({ length: frameCount }, (_, index) => (
                <i
                    key={index}
                    aria-hidden="true"
                    data-active={index < filled || undefined}
                    data-current={(isRunning && index === filled - 1) || undefined}
                />
            ))}
        </div>
    );
}
