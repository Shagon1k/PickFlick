'use client';

import type { TMovieDetails } from '@pickflick/contracts';
import clsx from 'clsx';
import { useEffect, useRef } from 'react';

import { formatRuntime } from '#lib/format';

import styles from './FilmMeta.module.scss';

const MAX_GENRES = 3;
const RULE_WIDTH_PX = 1;
const ROUNDING_SLACK_PX = 2;

/**
 * Year, runtime and (on Movie Details) the language read plainly; the genres follow a hairline in
 * the display italic. The Session header and Movie Details share it. When the line cannot fit,
 * the genres take a second line, both lines centre and the hairline goes.
 */
export default function FilmMeta({
    movie,
    language,
    className,
}: {
    movie: TMovieDetails;
    language?: string | null;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const facts = [movie.releaseYear, formatRuntime(movie.runtime), language].filter(Boolean);
    const genres = movie.genres?.slice(0, MAX_GENRES) ?? [];
    useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;
        const observer = new ResizeObserver(() =>
            node.toggleAttribute('data-wrapped', isWrapping(node)),
        );
        observer.observe(node);
        return () => observer.disconnect();
    }, []);
    return (
        // A div, not a paragraph, so a host page's paragraph rules leave it alone.
        <div className={clsx(styles.meta, className)} ref={ref}>
            {facts.map((fact) => (
                <span key={fact}>{fact}</span>
            ))}
            {facts.length > 0 && genres.length > 0 ? (
                <span aria-hidden="true" className={styles.rule} data-rule />
            ) : null}
            {genres.length ? <span className={styles.genres}>{genres.join(', ')}</span> : null}
        </div>
    );
}

/**
 * Compares the one-line width with the room available. The hairline counts at its full width even
 * while hidden, so hiding it can never pull the genres back and flip the state.
 */
function isWrapping(node: HTMLElement) {
    const items = [...node.children] as HTMLElement[];
    const gap = Number.parseFloat(getComputedStyle(node).columnGap) || 0;
    const width = items.reduce(
        (total, item) =>
            total + (item.hasAttribute('data-rule') ? RULE_WIDTH_PX : item.offsetWidth),
        gap * (items.length - 1),
    );
    // Rounded item widths can overshoot a shrink-to-fit line by a pixel or two.
    return width > node.clientWidth + ROUNDING_SLACK_PX;
}
