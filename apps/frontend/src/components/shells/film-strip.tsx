'use client';

import { type ReactNode, useState } from 'react';

import styles from '@/components/shells/product-navigation.module.scss';
import type { TShellMenuItem } from '@/components/shells/shell-navigation';
import Icon, { type TIconName } from '@/components/ui/Icon/Icon';
import { authClient } from '@/lib/auth-client';

export function NavigationItemIcon({ label }: { label: string }) {
    const iconByLabel: Record<string, TIconName> = {
        'Admin Panel': 'admin',
        'Application settings': 'settings',
        'Contact Us': 'contact',
        'Create a Club': 'overview',
        'Import & Export': 'import-export',
        'Join a Club': 'user-plus',
        'Manage Club': 'settings',
        'My Library': 'book',
        'My Ratings': 'ratings',
        Achievements: 'achievements',
        Clubs: 'club-building',
        Manage: 'settings',
        Members: 'members',
        Notifications: 'bell',
        Overview: 'overview',
        Pricing: 'pricing',
        Privacy: 'privacy',
        'Privacy & data': 'privacy',
        Profile: 'profile',
        Ratings: 'ratings',
        Sessions: 'sessions',
        Settings: 'settings',
        'Sign out': 'sign-out',
        Subscription: 'credit-card',
        Users: 'members',
        Watchlist: 'watchlist',
    };

    return <Icon className={styles.menuIcon} name={iconByLabel[label] ?? 'circle'} />;
}

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

export function FilmStrip({ items, label }: { items: readonly TShellMenuItem[]; label: string }) {
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
