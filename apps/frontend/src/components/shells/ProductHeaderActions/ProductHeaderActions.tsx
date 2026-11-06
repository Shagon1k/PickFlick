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
import type { TShellMenuItem } from '#components/shells/shell-navigation';
import Avatar from '#components/ui/Avatar/Avatar';
import Icon from '#components/ui/Icon/Icon';
import { authClient } from '#lib/auth-client';

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
    const { data: notifications } = useNotifications();

    useOverlayDismissal({
        isOpen: isAccountMenuOpen,
        rootRef: accountRef,
        closeOverlay,
        shouldTrapFocus: true,
    });
    useOverlayDismissal({
        isOpen: isNotificationsPanelOpen,
        rootRef: notificationsRef,
        closeOverlay,
        shouldTrapFocus: true,
    });

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
                    data-color-reveal-trigger
                    data-product-overlay-control
                    onClick={(event) => toggleOverlay('account', event.currentTarget)}
                    type="button"
                >
                    {session?.user.name ? (
                        <span className={styles.avatarImage}>
                            <Avatar
                                key={session.user.id}
                                name={session.user.name}
                                src={session.user.image ? '/api/account/avatar' : null}
                                size="large"
                            />
                        </span>
                    ) : (
                        <Icon className={styles.roundIcon} name="profile" />
                    )}
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
