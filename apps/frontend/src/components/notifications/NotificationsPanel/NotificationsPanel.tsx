import type { RefObject } from 'react';

import { useNotifications } from '#components/notifications/notifications-context';
import styles from '#components/shells/product-navigation.module.scss';

import NotificationItems from './NotificationItems';

interface INotificationsPanelProps {
    id: string;
    isMobile?: boolean;
    open: boolean;
    panelRef: RefObject<HTMLDivElement | null>;
}

export default function NotificationsPanel({
    id,
    isMobile = false,
    open,
    panelRef,
}: INotificationsPanelProps) {
    const { data, error, isLoading, isSaving, isLive, refresh, markRead } = useNotifications();
    const unreadCount = data?.unreadCount ?? 0;
    return (
        <div
            aria-label="Notifications"
            className={
                isMobile
                    ? `${styles.notifPopover} ${styles.notifPopoverMobile}`
                    : styles.notifPopover
            }
            data-open={open || undefined}
            id={id}
            inert={!open}
            ref={panelRef}
            role="dialog"
            tabIndex={-1}
        >
            <div className={styles.notifHeader}>
                <div>
                    <h2>Notifications</h2>
                    <span aria-live="polite">
                        {unreadCount ? `${unreadCount} unread` : 'You’re all caught up'}
                    </span>
                </div>
                <button
                    disabled={!unreadCount || isSaving}
                    onClick={() => {
                        panelRef.current?.focus({ preventScroll: true });
                        void markRead();
                    }}
                    type="button"
                >
                    Mark all as read
                </button>
            </div>
            {error ? (
                <div className={styles.notifFeedback} role="alert">
                    <p>{error}</p>
                    <button
                        type="button"
                        onClick={() => {
                            void refresh();
                        }}
                    >
                        Try again
                    </button>
                </div>
            ) : null}
            {!isLive && data ? (
                <p className={styles.notifStatus} role="status">
                    Live updates paused. Checking for updates automatically.
                </p>
            ) : null}
            {isLoading && !data ? (
                <p className={styles.overlayEmpty} role="status">
                    Loading notifications…
                </p>
            ) : null}
            {data?.items.length === 0 ? (
                <p className={styles.overlayEmpty}>No notifications yet.</p>
            ) : null}
            <NotificationItems panelRef={panelRef} />
        </div>
    );
}
