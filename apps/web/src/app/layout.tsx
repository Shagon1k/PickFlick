import type { ReactNode } from 'react';

import {
    ProjectorNoirColorSchemeScript,
    ProjectorNoirProvider,
    projectorNoirHtmlProps,
} from '@pickflick/ui';
import '@pickflick/ui/styles.css';
import { rootMetadata } from '@/lib/public-metadata';
import '@/styles/globals.scss';

export const metadata = rootMetadata;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
    return (
        <html lang="en" {...projectorNoirHtmlProps}>
            <head>
                <ProjectorNoirColorSchemeScript />
            </head>
            <body>
                <ProjectorNoirProvider>{children}</ProjectorNoirProvider>
            </body>
        </html>
    );
}
