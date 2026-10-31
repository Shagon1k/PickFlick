import type { TNotificationEvent, TNotificationList } from '@pickflick/contracts';
import Link from 'next/link';
import type { RefObject } from 'react';

import { useNotifications } from '#components/notifications/notifications-context';
import styles from '#components/shells/product-navigation.module.scss';
import { useProductOverlay } from '#components/shells/product-overlay';
import Icon, { type TIconName } from '#components/ui/Icon/Icon';
import LocalTime from '#components/ui/LocalTime/LocalTime';

const NOTIFICATION_ICONS: Partial<Record<TNotificationEvent, TIconName>> = {
    SESSION_STARTED: 'clapperboard',
    SELECTION_OPENED: 'check',
    SELECTION_CLOSED: 'check',
    RATING_OPENED: 'star-circle',
    RATING_CLOSED: 'star-circle',
    ACHIEVEMENT_EARNED: 'achievements',
    MEMBERSHIP_JOINED: 'user-plus',
    MEMBERSHIP_REMOVED: 'user-x',
    MEMBERSHIP_LEFT: 'user-x',
    BILLING_SERVICE: 'credit-card',
};

type TNotificationItem = TNotificationList['items'][number];

interface INotificationItemsProps {
    panelRef: RefObject<HTMLDivElement | null>;
}

export default function NotificationItems({ panelRef }: INotificationItemsProps) {
    const { data, isLoading, markRead, loadMore } = useNotifications();
    if (!data?.items.length) return null;
    return (
        <div className={styles.notifList} aria-busy={isLoading}>
            <ul>
                {data.items.map((item) => (
                    <NotificationItem
                        key={item.id}
                        item={item}
                        onRead={() => {
                            panelRef.current?.focus({ preventScroll: true });
                            void markRead(item.id);
                        }}
                    />
                ))}
            </ul>
            {data.nextCursor ? (
                <button
                    className={styles.notifMore}
                    disabled={isLoading}
                    onClick={() => {
                        panelRef.current?.focus({ preventScroll: true });
                        void loadMore();
                    }}
                    type="button"
                >
                    {isLoading ? 'Loading…' : 'Load more'}
                </button>
            ) : null}
        </div>
    );
}

function NotificationItem({ item, onRead }: { item: TNotificationItem; onRead: () => void }) {
    const { closeOverlay } = useProductOverlay();
    const { isSaving } = useNotifications();
    const body = (
        <>
            <p>{item.message}</p>
            <LocalTime format="short" value={item.createdAt} />
        </>
    );
    return (
        <li className={styles.notifItem}>
            <Icon className={styles.notifIcon} name={NOTIFICATION_ICONS[item.event] ?? 'bell'} />
            {item.href ? (
                <Link
                    className={styles.notifBody}
                    href={item.href}
                    onClick={() => closeOverlay({ shouldReturnFocus: false })}
                >
                    {body}
                </Link>
            ) : (
                <div className={styles.notifBody}>{body}</div>
            )}
            {item.readAt === null ? (
                <button
                    className={styles.notifRead}
                    disabled={isSaving}
                    aria-label={`Mark as read: ${item.message}`}
                    onClick={onRead}
                    type="button"
                >
                    <span />
                </button>
            ) : null}
        </li>
    );
}
