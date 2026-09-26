'use client';

import { useEffect, useRef, useState } from 'react';

import styles from '@/components/shells/product-navigation.module.scss';
import { useOverlayDismissal, useProductOverlay } from '@/components/shells/product-overlay';
import Icon from '@/components/ui/Icon/Icon';

export default function ProductSearch() {
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
                <label className="visually-hidden" htmlFor="shell-search-input">
                    Search films
                </label>
                <input
                    autoComplete="off"
                    className={styles.globalSearchInput}
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
