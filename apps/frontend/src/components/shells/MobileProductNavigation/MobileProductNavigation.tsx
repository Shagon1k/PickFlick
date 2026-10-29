'use client';

import { useEffect, useRef } from 'react';

import { useNotifications } from '#components/notifications/notifications-context';
import NotificationsPanel from '#components/notifications/NotificationsPanel/NotificationsPanel';
import FilmStrip from '#components/shells/FilmStrip/FilmStrip';
import styles from '#components/shells/product-navigation.module.scss';
import {
    useAnchoredMenus,
    useOverlayDismissal,
    useProductOverlay,
} from '#components/shells/product-overlay';
import type { TMobileNavigationEntry } from '#components/shells/shell-navigation';
import Icon from '#components/ui/Icon/Icon';

interface IMobileProductNavigationProps {
    entries: readonly TMobileNavigationEntry[];
}

export default function MobileProductNavigation({ entries }: IMobileProductNavigationProps) {
    const { data: notifications } = useNotifications();
    const { activeOverlay, closeOverlay, toggleOverlay } = useProductOverlay();
    const navigationRef = useRef<HTMLElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const activeMenu = activeOverlay?.startsWith('mobile:')
        ? activeOverlay.slice('mobile:'.length)
        : null;
    const isNotificationsPanelOpen = activeOverlay === 'notifications-mobile';

    useOverlayDismissal({ isOpen: activeMenu !== null, rootRef: navigationRef, closeOverlay });
    useOverlayDismissal({
        isOpen: isNotificationsPanelOpen,
        rootRef: notificationsRef,
        closeOverlay,
        shouldTrapFocus: true,
    });

    useAnchoredMenus(activeMenu, navigationRef);

    useEffect(() => {
        if (isNotificationsPanelOpen) {
            notificationsRef.current?.focus({ preventScroll: true });
        }
    }, [isNotificationsPanelOpen]);

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
                                        aria-expanded={isNotificationsPanelOpen}
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
                                        {notifications?.unreadCount ? (
                                            <span
                                                className={styles.notifBadge}
                                                aria-hidden="true"
                                            />
                                        ) : null}
                                        <span>{entry.label}</span>
                                        {/* A label on the empty badge would be skipped by screen readers. */}
                                        {notifications?.unreadCount ? (
                                            <span className="visually-hidden">
                                                {`, ${notifications.unreadCount} unread`}
                                            </span>
                                        ) : null}
                                    </button>
                                </div>
                            );
                        }

                        const isOpen = activeMenu === entry.id;
                        return (
                            <div
                                className={styles.navGroup}
                                data-menu-anchor
                                data-open={isOpen || undefined}
                                key={entry.id}
                            >
                                <button
                                    aria-controls={`mobile-${entry.id}-menu`}
                                    aria-current={entry.current ? 'page' : undefined}
                                    aria-expanded={isOpen}
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
                                    inert={!isOpen}
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
                open={isNotificationsPanelOpen}
                panelRef={notificationsRef}
            />
        </>
    );
}
