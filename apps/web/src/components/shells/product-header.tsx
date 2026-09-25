'use client';

import { useEffect, useRef, useState } from 'react';

import { Icon } from '@pickflick/ui';

import { authClient } from '@/lib/auth-client';
import { FilmStrip } from '@/components/shells/film-strip';
import { NotificationsPanel } from '@/components/shells/notifications-panel';
import {
    useAnchoredMenus,
    useOverlayDismissal,
    useProductOverlay,
} from '@/components/shells/product-overlay';
import type { ShellMenuItem } from '@/components/shells/shell-navigation';
import styles from '@/components/shells/product-navigation.module.scss';

/** Up to two initials from the viewer's display name; empty when no usable name exists. */
function initialsFor(name: string | null | undefined): string {
    const words = (name ?? '').trim().split(/\s+/u).filter(Boolean);
    const initials =
        words.length > 1
            ? `${words[0]?.[0] ?? ''}${words.at(-1)?.[0] ?? ''}`
            : (words[0] ?? '').slice(0, 2);
    return initials.toUpperCase();
}

export function ProductHeaderActions({
    accountItems,
}: Readonly<{ accountItems: readonly ShellMenuItem[] }>) {
    const { activeOverlay, closeOverlay, toggleOverlay } = useProductOverlay();
    const accountRef = useRef<HTMLDivElement>(null);
    const actionsRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const accountOpen = activeOverlay === 'account';
    const notificationsOpen = activeOverlay === 'notifications';
    const { data: session } = authClient.useSession();
    const initials = initialsFor(session?.user.name);

    useOverlayDismissal(accountOpen, accountRef, closeOverlay, true);
    useOverlayDismissal(notificationsOpen, notificationsRef, closeOverlay, true);

    useAnchoredMenus(accountOpen ? 'account' : null, actionsRef);

    useEffect(() => {
        if (notificationsOpen) {
            notificationsRef.current?.focus({ preventScroll: true });
        }
    }, [notificationsOpen]);

    return (
        <div className={styles.headerActions} ref={actionsRef}>
            <button
                aria-controls="shell-search"
                aria-expanded={activeOverlay === 'search'}
                aria-label="Search films"
                className={styles.roundButton}
                data-product-overlay-control
                onClick={(event) => toggleOverlay('search', event.currentTarget)}
                type="button"
            >
                <Icon className={styles.roundIcon} name="search" />
            </button>
            <div className={`${styles.popoverAnchor} ${styles.desktopHeaderAction}`}>
                <button
                    aria-controls="shell-notifications"
                    aria-expanded={notificationsOpen}
                    aria-haspopup="dialog"
                    aria-label="Notifications"
                    className={styles.roundButton}
                    data-product-overlay-control
                    onClick={(event) => toggleOverlay('notifications', event.currentTarget)}
                    type="button"
                >
                    <Icon className={styles.roundIcon} name="bell" />
                </button>
                <NotificationsPanel
                    id="shell-notifications"
                    open={notificationsOpen}
                    panelRef={notificationsRef}
                />
            </div>
            <div
                className={`${styles.popoverAnchor} ${styles.desktopHeaderAction}`}
                data-menu-anchor
            >
                <button
                    aria-controls="shell-account-menu"
                    aria-expanded={accountOpen}
                    aria-label="Account menu"
                    className={styles.avatarButton}
                    data-product-overlay-control
                    onClick={(event) => toggleOverlay('account', event.currentTarget)}
                    type="button"
                >
                    {initials || <Icon className={styles.roundIcon} name="profile" />}
                </button>
                <div
                    className={styles.accountPopover}
                    data-anchored-menu="account"
                    data-open={accountOpen || undefined}
                    id="shell-account-menu"
                    inert={!accountOpen}
                    ref={accountRef}
                >
                    <span aria-hidden="true" className={styles.filmTail} />
                    <FilmStrip items={accountItems} label="Account navigation" />
                </div>
            </div>
        </div>
    );
}

export function ProductSearch() {
    const { activeOverlay, closeOverlay } = useProductOverlay();
    const open = activeOverlay === 'search';
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState('');
    const [wasOpen, setWasOpen] = useState(open);

    if (wasOpen !== open) {
        setWasOpen(open);
        if (!open) {
            setQuery('');
        }
    }

    useOverlayDismissal(open, rootRef, closeOverlay, true);

    useEffect(() => {
        if (open) {
            inputRef.current?.focus({ preventScroll: true });
        }
    }, [open]);

    return (
        <div
            aria-label="Film search"
            className={styles.globalSearch}
            data-open={open || undefined}
            id="shell-search"
            inert={!open}
            ref={rootRef}
            role="search"
        >
            <div className={styles.globalSearchInner}>
                <label className="pf-visually-hidden" htmlFor="shell-search-input">
                    Search films
                </label>
                <input
                    autoComplete="off"
                    className={`pf-control ${styles.globalSearchInput}`}
                    id="shell-search-input"
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search films…"
                    ref={inputRef}
                    type="search"
                    value={query}
                />
                <button
                    aria-label="Close search"
                    className={styles.searchClose}
                    onClick={() => closeOverlay()}
                    type="button"
                >
                    <Icon className={styles.roundIcon} name="close" />
                </button>
                <div className={styles.searchResults} role="status">
                    {query.trim() ? (
                        <p className={styles.overlayEmpty}>Film search isn’t available yet.</p>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
