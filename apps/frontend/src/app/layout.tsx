import '@/styles/globals.scss';

import { headers } from 'next/headers';
import type { ReactNode } from 'react';

import ThemeProvider, { themeHtmlProps } from '@/components/ui/ThemeProvider/ThemeProvider';
import ThemeScript from '@/components/ui/ThemeProvider/ThemeScript';
import { rootMetadata } from '@/lib/public-metadata';

export const metadata = rootMetadata;

export default async function RootLayout({ children }: { children: ReactNode }) {
    const nonce = (await headers()).get('x-nonce') ?? undefined;
    return (
        <html lang="en" {...themeHtmlProps}>
            <head>
                <ThemeScript nonce={nonce} />
            </head>
            <body>
                <ThemeProvider>{children}</ThemeProvider>
            </body>
        </html>
    );
}
