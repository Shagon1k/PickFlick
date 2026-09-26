'use client';

import styles from './DenseRegion.module.scss';

interface IDenseRegionProps {
    label: string;
}

/** A wide placeholder grid that scrolls inside its own region, by pointer or arrow keys. */
export default function DenseRegion({ label }: IDenseRegionProps) {
    return (
        <div
            aria-label={label}
            className={styles.denseRegion}
            onKeyDown={(event) => {
                if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
                    return;
                }
                event.preventDefault();
                event.currentTarget.scrollLeft += event.key === 'ArrowRight' ? 80 : -80;
            }}
            role="region"
            tabIndex={0}
        >
            <div className={styles.denseGrid}>
                {['Column one', 'Column two', 'Column three', 'Column four'].map((heading) => (
                    <strong key={heading}>{heading}</strong>
                ))}
                {Array.from({ length: 8 }, (_, index) => (
                    <span key={index}>Content</span>
                ))}
            </div>
        </div>
    );
}
