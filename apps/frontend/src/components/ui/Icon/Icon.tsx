import type { ReactNode, SVGAttributes } from 'react';

import { metadataGlyphs } from './metadata-glyphs';
import { statGlyphs } from './stat-glyphs';

export type TIconName =
    | 'bulb'
    | 'document'
    | 'calendar'
    | 'pin'
    | 'info'
    | 'refresh'
    | 'film-reel'
    | 'clapperboard'
    | 'star-circle'
    | 'stopwatch'
    | 'genre'
    | 'director'
    | 'actor'
    | 'achievements'
    | 'admin'
    | 'apple'
    | 'arrow-left'
    | 'bell'
    | 'book'
    | 'cancel'
    | 'catalog'
    | 'chart'
    | 'chevron-right'
    | 'circle'
    | 'clock'
    | 'close'
    | 'club-building'
    | 'clubs'
    | 'contact'
    | 'credit-card'
    | 'device'
    | 'edit'
    | 'google'
    | 'hub'
    | 'import-export'
    | 'library'
    | 'members'
    | 'overview'
    | 'pricing'
    | 'privacy'
    | 'profile'
    | 'question'
    | 'pulse'
    | 'ratings'
    | 'search'
    | 'sessions'
    | 'settings'
    | 'sign-out'
    | 'user-plus'
    | 'watchlist';

export interface IIconProps extends Omit<SVGAttributes<SVGSVGElement>, 'children'> {
    name: TIconName;
}

const glyphs: Record<TIconName, ReactNode> = {
    ...metadataGlyphs,
    ...statGlyphs,
    achievements: (
        <>
            <circle cx="12" cy="8" r="7" />
            <path d="M8.21 13.89 7 23l5-3 5 3-1.21-9.12" />
        </>
    ),
    admin: (
        <>
            <path d="M12 3l8 4v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V7z" />
            <path d="m9 12 2 2 4-4" />
        </>
    ),
    apple: (
        <>
            <path
                fill="currentColor"
                d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09ZM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25Z"
            />
        </>
    ),
    'arrow-left': (
        <>
            <path d="M19 12H5M12 19l-7-7 7-7" />
        </>
    ),
    bell: (
        <>
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </>
    ),
    book: (
        <>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </>
    ),
    cancel: (
        <>
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6M9 9l6 6" />
        </>
    ),
    catalog: (
        <>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2ZM8 7h8M8 10h6" />
        </>
    ),
    chart: (
        <>
            <path d="M6 20v-4M12 20V10M18 20V4" />
        </>
    ),
    'chevron-right': (
        <>
            <path d="m9 18 6-6-6-6" />
        </>
    ),
    circle: (
        <>
            <circle cx="12" cy="12" r="7" />
        </>
    ),
    clock: (
        <>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
        </>
    ),
    close: (
        <>
            <path d="M18 6 6 18M6 6l12 12" />
        </>
    ),
    'club-building': (
        <>
            <path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" />
        </>
    ),
    clubs: (
        <>
            <rect height="18" rx="2" width="18" x="3" y="3" />
            <path d="M9 3v18M14 8h4M14 12h4" />
        </>
    ),
    contact: (
        <>
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <path d="m22 6-10 7L2 6" />
        </>
    ),
    'credit-card': (
        <>
            <rect height="14" rx="2" width="20" x="2" y="5" />
            <path d="M2 10h20" />
        </>
    ),
    device: (
        <>
            <rect height="20" rx="3" width="14" x="5" y="2" />
            <path d="M10 18h4" />
        </>
    ),
    edit: (
        <>
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
        </>
    ),
    google: (
        <>
            <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32l3.57 2.76a12 12 0 0 0 3.27-8.09Z"
            />
            <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76A6.95 6.95 0 0 1 12 19.14c-3.15 0-5.82-2.13-6.77-5L1.53 17A11.04 11.04 0 0 0 12 23Z"
            />
            <path
                fill="currentColor"
                d="M5.23 14.14a7.12 7.12 0 0 1 0-4.28L1.53 7A11.04 11.04 0 0 0 1 12c0 1.78.42 3.46 1.22 4.99l3.7-2.86Z"
            />
            <path
                fill="currentColor"
                d="M12 4.86c1.6 0 3.04.55 4.17 1.63l3.12-3.12A11.04 11.04 0 0 0 12 1C8.1 1 4.68 2.83 2.53 5.7l3.7 2.86A7.13 7.13 0 0 1 12 4.86Z"
            />
        </>
    ),
    hub: (
        <>
            <path d="m3 10 17-4.5-.9-3.4-17 4.5z" />
            <path d="m7.4 5.2 2.2 3.5M12.6 3.8l2.2 3.5" />
            <rect height="11" rx="1.5" width="18" x="3" y="10" />
            <path d="M7 14h10M7 17.5h6" />
        </>
    ),
    'import-export': (
        <>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <path d="m7 10 5 5 5-5M12 15V3" />
        </>
    ),
    library: (
        <>
            <rect height="20" rx="2" width="16" x="4" y="2" />
            <path d="M8 2v20M16 2v20M8 12h8M4 6h4M4 10h4M4 14h4M4 18h4M16 6h4M16 10h4M16 14h4M16 18h4" />
        </>
    ),
    members: (
        <>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
        </>
    ),
    overview: (
        <>
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <path d="M9 22V12h6v10" />
        </>
    ),
    pricing: (
        <>
            <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </>
    ),
    privacy: (
        <>
            <rect height="11" rx="2" width="18" x="3" y="11" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </>
    ),
    profile: (
        <>
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
        </>
    ),
    pulse: (
        <>
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </>
    ),
    question: (
        <>
            <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
        </>
    ),
    ratings: (
        <>
            <path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
        </>
    ),
    sessions: (
        <>
            <rect height="18" rx="2" width="18" x="3" y="4" />
            <path d="M16 2v4M8 2v4M3 10h18" />
        </>
    ),
    search: (
        <>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
        </>
    ),
    settings: (
        <>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </>
    ),
    'sign-out': (
        <>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
        </>
    ),
    'user-plus': (
        <>
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <path d="M20 8v6M23 11h-6" />
        </>
    ),
    watchlist: (
        <>
            <path d="m19 21-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </>
    ),
};

export default function Icon({ name, ...props }: IIconProps) {
    const common = {
        ...props,
        'aria-hidden': true,
        fill: 'none',
        focusable: 'false',
        viewBox: '0 0 24 24',
    } as const;

    return <svg {...common}>{glyphs[name]}</svg>;
}
