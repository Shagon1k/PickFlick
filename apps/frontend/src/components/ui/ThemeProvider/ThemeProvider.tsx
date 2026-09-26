import '@mantine/core/styles.layer.css';

import { ColorSchemeScript, mantineHtmlProps, MantineProvider } from '@mantine/core';
import type { ReactNode } from 'react';

import { theme } from '@/theme/mantine';

// Projector Noir is dark only, so the scheme is forced before hydration.
export const themeHtmlProps = { ...mantineHtmlProps, 'data-mantine-color-scheme': 'dark' } as const;

export function ThemeScript() {
    return <ColorSchemeScript defaultColorScheme="dark" forceColorScheme="dark" />;
}

export default function ThemeProvider({ children }: { children: ReactNode }) {
    return (
        <MantineProvider
            defaultColorScheme="dark"
            forceColorScheme="dark"
            theme={theme}
            withGlobalClasses={false}
            withStaticClasses={false}
        >
            {children}
        </MantineProvider>
    );
}
