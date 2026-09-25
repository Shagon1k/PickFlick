import { ColorSchemeScript, MantineProvider, createTheme, mantineHtmlProps } from '@mantine/core';
import type { ReactNode } from 'react';

export const projectorNoirTheme = createTheme({
    colors: {
        projectorGold: [
            '#fff8ed',
            '#f5e6cf',
            '#ebd3ae',
            '#e0bc85',
            '#d5aa68',
            '#c89b55',
            '#ae7f3f',
            '#8a6330',
            '#64451f',
            '#3d2913',
        ],
    },
    cursorType: 'pointer',
    defaultRadius: 'md',
    fontFamily: 'var(--font-body)',
    headings: { fontFamily: 'var(--font-display)' },
    primaryColor: 'projectorGold',
    respectReducedMotion: true,
});

export const projectorNoirHtmlProps = {
    ...mantineHtmlProps,
    'data-mantine-color-scheme': 'dark',
} as const;

export function ProjectorNoirColorSchemeScript() {
    return <ColorSchemeScript defaultColorScheme="dark" forceColorScheme="dark" />;
}

export function ProjectorNoirProvider({ children }: Readonly<{ children: ReactNode }>) {
    return (
        <MantineProvider
            defaultColorScheme="dark"
            forceColorScheme="dark"
            theme={projectorNoirTheme}
            withGlobalClasses={false}
            withStaticClasses={false}
        >
            {children}
        </MantineProvider>
    );
}
