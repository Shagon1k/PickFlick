import '#styles/globals.scss';

import { connection } from 'next/server';
import type { ReactNode } from 'react';

import ThemeProvider, { themeHtmlProps } from '#components/ui/ThemeProvider/ThemeProvider';
import { rootMetadata } from '#lib/public-metadata';

export const metadata = rootMetadata;

export default async function RootLayout({ children }: { children: ReactNode }) {
    // Next.js stamps the CSP nonce on its scripts only while rendering per request, so no page
    // may be prerendered (see proxy.ts).
    await connection();
    return (
        <html lang="en" {...themeHtmlProps}>
            <body>
                <ThemeProvider>{children}</ThemeProvider>
            </body>
        </html>
    );
}
