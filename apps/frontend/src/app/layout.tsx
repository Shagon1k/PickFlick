import '@/styles/globals.scss';

import type { ReactNode } from 'react';

import ThemeProvider, { themeHtmlProps } from '@/components/ui/ThemeProvider/ThemeProvider';
import ThemeScript from '@/components/ui/ThemeProvider/ThemeScript';
import { rootMetadata } from '@/lib/public-metadata';

export const metadata = rootMetadata;

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="en" {...themeHtmlProps}>
            <head>
                <ThemeScript />
            </head>
            <body>
                <ThemeProvider>{children}</ThemeProvider>
            </body>
        </html>
    );
}
