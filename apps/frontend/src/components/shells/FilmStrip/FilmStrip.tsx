'use client';

import Link from 'next/link';
import { type ReactNode, useState } from 'react';

import styles from '#components/shells/product-navigation.module.scss';
import { useProductOverlay } from '#components/shells/product-overlay';
import type { TShellMenuItem } from '#components/shells/shell-navigation';
import Icon from '#components/ui/Icon/Icon';
import { authClient } from '#lib/auth-client';

function FilmMenuItem({ item }: { item: TShellMenuItem }) {
    // Hub sections share a persistent frame, so a route change alone would leave the strip open.
    const { closeOverlay } = useProductOverlay();
    const content = (
        <>
            <Icon className={styles.menuIcon} name={item.icon ?? 'circle'} />
            <b>{item.label}</b>
        </>
    );

    return 'href' in item ? (
        <Link
            aria-current={item.current ? 'page' : undefined}
            className={styles.filmFrame}
            href={item.href}
            onClick={() => closeOverlay()}
        >
            {content}
        </Link>
    ) : (
        <SignOutMenuItem content={content} />
    );
}

interface IFilmStripProps {
    items: readonly TShellMenuItem[];
    label: string;
}

export default function FilmStrip({ items, label }: IFilmStripProps) {
    return (
        <div className={styles.filmStrip}>
            <nav aria-label={label}>
                {items.map((item) => (
                    <FilmMenuItem item={item} key={item.label} />
                ))}
            </nav>
        </div>
    );
}

function SignOutMenuItem({ content }: { content: ReactNode }) {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState('');

    async function handleSignOut() {
        setIsPending(true);
        setError('');
        try {
            const result = await authClient.signOut();
            if (result.error) {
                setError('Sign out failed. Please try again.');
                setIsPending(false);
                return;
            }
            // A full load after sign-out drops every cached signed-in page.
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- see above
            window.location.assign('/login');
        } catch {
            setError('Sign out failed. Please try again.');
            setIsPending(false);
        }
    }

    return (
        <>
            <button
                aria-busy={isPending || undefined}
                className={styles.filmFrame}
                data-shell-action="sign-out"
                disabled={isPending}
                onClick={handleSignOut}
                type="button"
            >
                {content}
            </button>
            {error ? (
                <span aria-live="assertive" className={styles.signOutError} role="alert">
                    {error}
                </span>
            ) : null}
        </>
    );
}
