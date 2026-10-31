import type { ReactNode } from 'react';

/** Each achievement's badge from the prototype shelf, drawn on a 24px stroke grid. */
export const ACHIEVEMENT_ICONS: Record<string, ReactNode> = {
    'first-screening': (
        <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4" />
        </>
    ),
    'full-house': (
        <>
            <circle cx="9" cy="8" r="3" />
            <circle cx="17" cy="9" r="2" />
            <path d="M3 20a6 6 0 0 1 12 0M14 20a4 4 0 0 1 7 0" />
        </>
    ),
    'critics-circle': (
        <>
            <circle cx="12" cy="12" r="8" />
            <path d="M8.5 12l2.2 2.2L15.8 9" />
        </>
    ),
    'cult-classic': (
        <>
            <rect x="3" y="7" width="18" height="13" rx="2" />
            <path d="M8 3v4M16 3v4M3 11h18" />
        </>
    ),
    'perfect-split': (
        <>
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </>
    ),
    'double-feature': (
        <>
            <path d="M4 9h16v10H4zM4 9l2-5 4 5 2-5 4 5 2-5 2 5" />
        </>
    ),
    'decade-tour': (
        <>
            <path d="M4 8a2 2 0 0 0 2-2h12a2 2 0 0 0 2 2v8a2 2 0 0 0-2 2H6a2 2 0 0 0-2-2z" />
            <path d="M9 8v8" />
        </>
    ),
    'marathon-night': (
        <>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
        </>
    ),
    'world-tour': (
        <>
            <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" />
            <path d="M3.6 9h16.8M3.6 15h16.8" />
            <path d="M12 3a15 15 0 0 1 0 18" />
            <path d="M12 3a15 15 0 0 0 0 18" />
        </>
    ),
    'first-ten': (
        <>
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
        </>
    ),
    'packed-calendar': (
        <>
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="8" y1="2" x2="8" y2="4" />
            <line x1="16" y1="2" x2="16" y2="4" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </>
    ),
    'shared-taste': (
        <>
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </>
    ),
    'genre-roulette': (
        <>
            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <path d="M4 22v-7" />
        </>
    ),
    'silent-era': (
        <>
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M8 3v4M16 3v4M3 10h18" />
        </>
    ),
    comeback: (
        <>
            <path d="M22 10l-6 6-4-4-8 8" />
            <path d="M22 10H14V2" />
        </>
    ),
    'opening-credits': (
        <>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
        </>
    ),
    'first-vote': (
        <>
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
        </>
    ),
    'reliable-viewer': (
        <>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </>
    ),
    critic: (
        <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
            <path d="M16 13H8" />
            <path d="M16 17H8" />
        </>
    ),
    'panda-patron': (
        <>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </>
    ),
    nominator: (
        <>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </>
    ),
    'never-miss': (
        <>
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </>
    ),
    'taste-maker': (
        <>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </>
    ),
    'genre-scout': (
        <>
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </>
    ),
    archivist: (
        <>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </>
    ),
    'long-review': (
        <>
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <path d="M14 2v6h6" />
        </>
    ),
    'night-owl': (
        <>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
        </>
    ),
    'early-bird': (
        <>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </>
    ),
    'hot-take': (
        <>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </>
    ),
};
