'use client';

import { useEffect, useRef } from 'react';

import FilmStrip from '#components/shells/FilmStrip/FilmStrip';
import { useNotifications } from '#components/shells/notifications-context';
import NotificationsPanel from '#components/shells/NotificationsPanel/NotificationsPanel';
import styles from '#components/shells/product-navigation.module.scss';
import {
    useAnchoredMenus,
    useOverlayDismissal,
    useProductOverlay,
} from '#components/shells/product-overlay';
import type { TShellMenuItem } from '#components/shells/shell-navigation';
import Icon from '#components/ui/Icon/Icon';
import { authClient } from '#lib/auth-client';

/** Up to two initials from the viewer's display name; empty when no usable name exists. */
function getInitials(name: string | null | undefined): string {
    const words = (name ?? '').trim().split(/\s+/u).filter(Boolean);
    const initials =
        words.length > 1
            ? `${words[0]?.[0] ?? ''}${words.at(-1)?.[0] ?? ''}`
            : (words[0] ?? '').slice(0, 2);
    return initials.toUpperCase();
}

interface IProductHeaderActionsProps {
    accountItems: readonly TShellMenuItem[];
}

export default function ProductHeaderActions({ accountItems }: IProductHeaderActionsProps) {
    const { activeOverlay, closeOverlay, toggleOverlay } = useProductOverlay();
    const accountRef = useRef<HTMLDivElement>(null);
    const actionsRef = useRef<HTMLDivElement>(null);
    const notificationsRef = useRef<HTMLDivElement>(null);
    const isAccountMenuOpen = activeOverlay === 'account';
    const isNotificationsPanelOpen = activeOverlay === 'notifications';
    const { data: session } = authClient.useSession();
    const initials = getInitials(session?.user.name);
    const { data: notifications } = useNotifications();

    useOverlayDismissal(isAccountMenuOpen, accountRef, closeOverlay, true);
    useOverlayDismissal(isNotificationsPanelOpen, notificationsRef, closeOverlay, true);

    useAnchoredMenus(isAccountMenuOpen ? 'account' : null, actionsRef);

    useEffect(() => {
        if (isNotificationsPanelOpen) {
            notificationsRef.current?.focus({ preventScroll: true });
        }
    }, [isNotificationsPanelOpen]);

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
                    aria-expanded={isNotificationsPanelOpen}
                    aria-haspopup="dialog"
                    aria-label={
                        notifications?.unreadCount
                            ? `Notifications, ${notifications.unreadCount} unread`
                            : 'Notifications'
                    }
                    className={styles.roundButton}
                    data-product-overlay-control
                    onClick={(event) => toggleOverlay('notifications', event.currentTarget)}
                    type="button"
                >
                    <Icon className={styles.roundIcon} name="bell" />
                    {notifications?.unreadCount ? <span className={styles.notifBadge} /> : null}
                </button>
                <NotificationsPanel
                    id="shell-notifications"
                    open={isNotificationsPanelOpen}
                    panelRef={notificationsRef}
                />
            </div>
            <div
                className={`${styles.popoverAnchor} ${styles.desktopHeaderAction}`}
                data-menu-anchor
            >
                <button
                    aria-controls="shell-account-menu"
                    aria-expanded={isAccountMenuOpen}
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
                    data-menu-align="right"
                    data-open={isAccountMenuOpen || undefined}
                    id="shell-account-menu"
                    inert={!isAccountMenuOpen}
                    ref={accountRef}
                >
                    <span aria-hidden="true" className={styles.filmTail} />
                    <FilmStrip items={accountItems} label="Account navigation" />
                </div>
            </div>
        </div>
    );
}
