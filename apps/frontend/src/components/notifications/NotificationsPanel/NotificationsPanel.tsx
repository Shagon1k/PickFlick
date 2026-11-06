import { type RefObject, useState } from 'react';

import { useNotifications } from '#components/notifications/notifications-context';
import styles from '#components/shells/product-navigation.module.scss';
import Alert from '#components/ui/Alert/Alert';
import Button from '#components/ui/Button/Button';
import Skeleton from '#components/ui/Skeleton/Skeleton';

import NotificationItems from './NotificationItems';

const MAX_BADGE_COUNT = 99;
const LOADING_ROW_COUNT = 3;

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
    const [isRetrying, setIsRetrying] = useState(false);
    const unreadCount = data?.unreadCount ?? 0;
    async function handleRetry() {
        setIsRetrying(true);
        try {
            await refresh();
        } finally {
            setIsRetrying(false);
        }
    }
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
                <div className={styles.notifTitle}>
                    <h2>Notifications</h2>
                    {unreadCount ? (
                        <span className={styles.notifUnreadCount} aria-hidden="true">
                            {unreadCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : unreadCount}
                        </span>
                    ) : null}
                </div>
                <Button
                    size="compact"
                    variant="ghost"
                    disabled={!unreadCount || isSaving}
                    onClick={() => {
                        panelRef.current?.focus({ preventScroll: true });
                        void markRead();
                    }}
                >
                    Mark all as read
                </Button>
                <span className="visually-hidden" aria-live="polite">
                    {unreadCount ? `${unreadCount} unread` : 'You’re all caught up'}
                </span>
            </div>
            {error ? (
                <div className={styles.notifFeedback}>
                    <Alert tone="warning">{error}</Alert>
                    <div>
                        <Button
                            loading={isRetrying}
                            size="small"
                            variant="subtle"
                            onClick={() => void handleRetry()}
                        >
                            Try again
                        </Button>
                    </div>
                </div>
            ) : null}
            {!isLive && data ? (
                <p className={styles.notifStatus} role="status">
                    Live updates paused. Checking for updates automatically.
                </p>
            ) : null}
            {isLoading && !data ? <NotificationsLoading /> : null}
            {data?.items.length === 0 ? (
                <p className={styles.overlayEmpty}>No notifications yet.</p>
            ) : null}
            <NotificationItems panelRef={panelRef} />
        </div>
    );
}

function NotificationsLoading() {
    return (
        <div role="status" aria-busy="true">
            <span className="visually-hidden">Loading notifications…</span>
            <div className={styles.notifList} aria-hidden="true" inert>
                <ul>
                    {Array.from({ length: LOADING_ROW_COUNT }, (_, index) => (
                        <li className={styles.notifItem} key={index}>
                            <span className={styles.notifIcon}>
                                <Skeleton shouldFill />
                            </span>
                            <div className={styles.notifBody}>
                                <p>
                                    <Skeleton text="Notification" />
                                </p>
                                <span className={styles.notifLoadingTime}>
                                    <Skeleton text="Time" />
                                </span>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
