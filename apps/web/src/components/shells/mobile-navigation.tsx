'use client';

import { useEffect, useRef } from 'react';

import Icon from '@/components/ui/Icon/Icon';

import { FilmStrip } from '@/components/shells/film-strip';
import { NotificationsPanel } from '@/components/shells/notifications-panel';
import {
    useAnchoredMenus,
    useOverlayDismissal,
    useProductOverlay,
} from '@/components/shells/product-overlay';
import type { MobileNavigationEntry } from '@/components/shells/shell-navigation';
import styles from '@/components/shells/product-navigation.module.scss';

export function MobileProductNavigation({
    entries,
}: Readonly<{ entries: readonly MobileNavigationEntry[] }>) {
    const { activeOverlay, closeOverlay, toggleOverlay } = useProductOverlay();
    const navigationRef = useRef<HTMLElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const activeMenu = activeOverlay?.startsWith('mobile:')
        ? activeOverlay.slice('mobile:'.length)
        : null;
    const notificationsOpen = activeOverlay === 'notifications-mobile';

    useOverlayDismissal(activeMenu !== null, navigationRef, closeOverlay);
    useOverlayDismissal(notificationsOpen, notificationsRef, closeOverlay, true);

    useAnchoredMenus(activeMenu, navigationRef);

    useEffect(() => {
        if (notificationsOpen) {
            notificationsRef.current?.focus({ preventScroll: true });
        }
    }, [notificationsOpen]);

    return (
        <>
            <nav
                aria-label="Mobile product navigation"
                className={styles.mobileNavigation}
                ref={navigationRef}
            >
                <div className={styles.mobileNavigationGrid}>
                    {entries.map((entry) => {
                        if ('overlay' in entry) {
                            return (
                                <div className={styles.navGroup} key={entry.id}>
                                    <button
                                        aria-controls="shell-notifications-mobile"
                                        aria-expanded={notificationsOpen}
                                        aria-haspopup="dialog"
                                        className={styles.navTrigger}
                                        data-product-overlay-control
                                        onClick={(event) =>
                                            toggleOverlay(
                                                'notifications-mobile',
                                                event.currentTarget,
                                            )
                                        }
                                        type="button"
                                    >
                                        <Icon className={styles.navGlyph} name="bell" />
                                        <span>{entry.label}</span>
                                    </button>
                                </div>
                            );
                        }

                        const open = activeMenu === entry.id;
                        return (
                            <div
                                className={styles.navGroup}
                                data-menu-anchor
                                data-open={open || undefined}
                                key={entry.id}
                            >
                                <button
                                    aria-controls={`mobile-${entry.id}-menu`}
                                    aria-current={entry.current ? 'page' : undefined}
                                    aria-expanded={open}
                                    className={styles.navTrigger}
                                    data-product-overlay-control
                                    onClick={(event) =>
                                        toggleOverlay(`mobile:${entry.id}`, event.currentTarget)
                                    }
                                    type="button"
                                >
                                    <Icon className={styles.navGlyph} name={entry.icon} />
                                    <span>{entry.label}</span>
                                </button>
                                <div
                                    className={styles.filmMenu}
                                    data-anchored-menu={entry.id}
                                    id={`mobile-${entry.id}-menu`}
                                    inert={!open}
                                >
                                    <FilmStrip
                                        items={entry.items}
                                        label={`${entry.name} sections`}
                                    />
                                    <span aria-hidden="true" className={styles.filmTail} />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </nav>
            <NotificationsPanel
                id="shell-notifications-mobile"
                mobile
                open={notificationsOpen}
                panelRef={notificationsRef}
            />
        </>
    );
}
