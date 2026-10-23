import type { ReactNode } from 'react';

import styles from './MovieLinks.module.scss';

/** Outbound pages for the film, each with its source's mark; phones keep only the marks. */
export default function MovieLinks({
    imdb,
    kinopoisk,
    letterboxd,
    title,
}: {
    imdb: string | null;
    kinopoisk: string | null;
    letterboxd: string | null;
    title: string | null;
}) {
    const wikipedia = title
        ? `https://en.wikipedia.org/w/index.php?${new URLSearchParams({ search: title })}`
        : null;
    if (!imdb && !kinopoisk && !letterboxd && !wikipedia) return null;
    return (
        <nav className={styles.links} aria-label="Movie links">
            {imdb ? <OutboundLink href={imdb} label="IMDb" mark={IMDB_MARK} /> : null}
            {kinopoisk ? (
                <OutboundLink href={kinopoisk} label="Kinopoisk" mark={KINOPOISK_MARK} />
            ) : null}
            {letterboxd ? (
                <OutboundLink href={letterboxd} label="Letterboxd" mark={LETTERBOXD_MARK} />
            ) : null}
            {wikipedia ? (
                <OutboundLink
                    href={wikipedia}
                    label="Wikipedia"
                    hint="search"
                    mark={WIKIPEDIA_MARK}
                />
            ) : null}
        </nav>
    );
}

function OutboundLink({
    href,
    label,
    mark,
    hint,
}: {
    href: string;
    label: string;
    mark: ReactNode;
    hint?: string;
}) {
    return (
        <a className={styles.link} href={href} rel="noopener noreferrer" target="_blank">
            <svg aria-hidden="true" viewBox="0 0 24 24">
                {mark}
            </svg>
            <span className={styles.label}>{label}</span>
            <span aria-hidden="true" className={styles.arrow}>
                ↗
            </span>
            <span className="visually-hidden">{hint ? ` ${hint}` : ''} (opens in a new tab)</span>
        </a>
    );
}

const IMDB_MARK = (
    <>
        <rect x="1" y="5" width="22" height="14" rx="2" fill="currentColor" />
        <text
            x="12"
            y="15.2"
            fill="var(--bg)"
            fontFamily="Arial, sans-serif"
            fontSize="7.2"
            fontWeight="900"
            letterSpacing="-.45"
            textAnchor="middle"
        >
            IMDb
        </text>
    </>
);

/** Kinopoisk's K with its rays, knocked out of a disc like the IMDb badge. */
const KINOPOISK_MARK = (
    <>
        <circle cx="12" cy="12" r="11.5" fill="currentColor" />
        <path
            fill="var(--bg)"
            d="M7.1 3.6h3.1v16.8H7.1zM10.2 12 14.3 3.6H18zM10.2 12l4.1 8.4H18zM10.2 12l10.5-7.3 1.3 2zM10.2 12l13-1.4v2.8zM10.2 12l11.8 5.3-1.3 2z"
        />
    </>
);

/** Letterboxd's three overlapping dots, told apart by tone instead of colour. */
const LETTERBOXD_MARK = (
    <>
        <circle cx="5.5" cy="12" r="4.5" fill="currentColor" />
        <circle cx="12" cy="12" r="4.5" fill="currentColor" fillOpacity="0.7" />
        <circle cx="18.5" cy="12" r="4.5" fill="currentColor" fillOpacity="0.45" />
    </>
);

const WIKIPEDIA_MARK = (
    <text
        x="12"
        y="18"
        fill="currentColor"
        fontFamily="Georgia, serif"
        fontSize="19"
        fontWeight="700"
        textAnchor="middle"
    >
        W
    </text>
);
