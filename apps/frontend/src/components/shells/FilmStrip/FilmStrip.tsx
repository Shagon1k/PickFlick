'use client';

import { type ReactNode, useState } from 'react';

import NavigationItemIcon from '@/components/shells/NavigationItemIcon/NavigationItemIcon';
import styles from '@/components/shells/product-navigation.module.scss';
import type { TShellMenuItem } from '@/components/shells/shell-navigation';
import { authClient } from '@/lib/auth-client';

function FilmMenuItem({ item }: { item: TShellMenuItem }) {
    const content = (
        <>
            <NavigationItemIcon label={item.label} />
            <b>{item.label}</b>
        </>
    );

    return 'href' in item ? (
        <a
            aria-current={item.current ? 'page' : undefined}
            className={styles.filmFrame}
            href={item.href}
        >
            {content}
        </a>
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
    const [pending, setPending] = useState(false);
    const [error, setError] = useState('');

    async function signOut() {
        setPending(true);
        setError('');
        try {
            const result = await authClient.signOut();
            if (result.error) {
                setError('Sign out failed. Please try again.');
                setPending(false);
                return;
            }
            window.location.assign('/login');
        } catch {
            setError('Sign out failed. Please try again.');
            setPending(false);
        }
    }

    return (
        <>
            <button
                aria-busy={pending || undefined}
                className={styles.filmFrame}
                data-shell-action="sign-out"
                disabled={pending}
                onClick={signOut}
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
