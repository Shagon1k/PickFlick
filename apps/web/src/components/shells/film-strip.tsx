'use client';

import { useState, type ReactNode } from 'react';

import { Icon, type IconName } from '@pickflick/ui';

import { authClient } from '../auth/auth-client';
import type { ShellMenuItem } from './shell-navigation';
import styles from './product-navigation.module.css';

export function NavigationItemIcon({ label }: Readonly<{ label: string }>) {
    const iconByLabel: Readonly<Record<string, IconName>> = {
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

function FilmMenuItem({ item }: Readonly<{ item: ShellMenuItem }>) {
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

export function FilmStrip({
    items,
    label,
}: Readonly<{ items: readonly ShellMenuItem[]; label: string }>) {
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

function SignOutMenuItem({ content }: Readonly<{ content: ReactNode }>) {
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
