import type { TNotificationEvent } from '@pickflick/contracts';
import Link from 'next/link';
import type { RefObject } from 'react';

import { useNotifications } from '#components/shells/notifications-context';
import styles from '#components/shells/product-navigation.module.scss';
import { useProductOverlay } from '#components/shells/product-overlay';
import Icon, { type TIconName } from '#components/ui/Icon/Icon';

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

interface INotificationItemsProps {
    panelRef: RefObject<HTMLDivElement | null>;
}

export default function NotificationItems({ panelRef }: INotificationItemsProps) {
    const { closeOverlay } = useProductOverlay();
    const { data, isLoading, isSaving, markRead, loadMore } = useNotifications();
    return data?.items.length ? (
        <div className={styles.notifList} aria-busy={isLoading}>
            <ul>
                {data.items.map((item) => {
                    const body = (
                        <>
                            <p>{item.message}</p>
                            <time dateTime={item.createdAt}>
                                {new Date(item.createdAt).toLocaleString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    timeZone: 'UTC',
                                })}
                            </time>
                        </>
                    );
                    return (
                        <li className={styles.notifItem} key={item.id}>
                            <Icon
                                className={styles.notifIcon}
                                name={NOTIFICATION_ICONS[item.event] ?? 'bell'}
                            />
                            {item.href ? (
                                <Link
                                    className={styles.notifBody}
                                    href={item.href}
                                    onClick={() => closeOverlay(false)}
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
                                    onClick={() => {
                                        panelRef.current?.focus({ preventScroll: true });
                                        void markRead(item.id);
                                    }}
                                    type="button"
                                >
                                    <span />
                                </button>
                            ) : null}
                        </li>
                    );
                })}
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
    ) : null;
}
