'use client';

import '@/styles/globals.scss';

import styles from './global-error.module.scss';

interface IGlobalErrorProps {
    error: Error & { digest?: string };
    retry: () => void;
}

/**
 * Replaces the root layout when the layout itself fails, so it relies on nothing the layout
 * provides: no Mantine, no shell, only global styles and plain elements.
 */
export default function GlobalError({ retry }: IGlobalErrorProps) {
    return (
        <html lang="en">
            <body>
                <title>Projector Malfunction — PickFlick</title>
                <main className={styles.page}>
                    <p className={styles.page__eyebrow}>Technical difficulties</p>
                    <h1>Projector Malfunction</h1>
                    <p>Something went wrong behind the scenes. Try again in a moment.</p>
                    <button className={styles.page__retry} onClick={() => retry()} type="button">
                        Try again
                    </button>
                </main>
            </body>
        </html>
    );
}
