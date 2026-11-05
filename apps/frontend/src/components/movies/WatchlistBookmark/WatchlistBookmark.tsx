'use client';

import type { TWatchlistItem, TWatchlistPriority } from '@pickflick/contracts';
import clsx from 'clsx';
import { useId, useRef, useState } from 'react';

import { WATCHLIST_PRIORITIES } from '#components/movies/watchlist-priority';
import Icon from '#components/ui/Icon/Icon';
import Popover from '#components/ui/Popover/Popover';
import { useActionStatus } from '#lib/use-action-status';

import { setWatchlistAction } from './actions';
import styles from './WatchlistBookmark.module.scss';

const RIBBON = 'M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z';

interface IWatchlistBookmarkProps {
    movieId: string;
    item: TWatchlistItem | null;
    variant?: 'poster' | 'table';
    onSaved?: (message: string) => void;
}

export default function WatchlistBookmark({
    movieId,
    item,
    variant = 'poster',
    onSaved,
}: IWatchlistBookmarkProps) {
    const id = useId();
    const feedbackRef = useRef<HTMLParagraphElement>(null);
    const [isOpen, setIsOpen] = useState(false);
    const { message, isSuccess, setMessage, announceSuccess, isPending, run } = useActionStatus();
    const label = item ? 'Edit watchlist priority' : 'Add to watchlist';
    const priorityLabel =
        WATCHLIST_PRIORITIES.find((priority) => priority.value === item?.priority)?.label ?? 'Save';

    function save(priority: TWatchlistPriority | null, { shouldClose = true } = {}) {
        run(() => setWatchlistAction(movieId, priority), {
            pendingMessage: 'Updating your Watchlist…',
            onResult: (result) => {
                if (!result.ok) {
                    setMessage(result.message);
                    feedbackRef.current?.focus();
                    return;
                }
                const savedMessage = priority ? 'Watchlist saved.' : 'Removed from Watchlist.';
                announceSuccess(savedMessage);
                if (shouldClose) setIsOpen(false);
                onSaved?.(savedMessage);
            },
        });
    }

    function handleOpen() {
        if (isPending) return;
        setIsOpen(!isOpen);
        // Opening an empty bookmark adds the film at once and keeps the priority choices open.
        if (!isOpen && !item) save('MEDIUM', { shouldClose: false });
    }

    return (
        <>
            <Popover
                id={id}
                label="Watchlist priority"
                variant="watchlist"
                open={isOpen}
                onChange={setIsOpen}
                trigger={
                    <button
                        aria-label={variant === 'table' ? `${label}: ${priorityLabel}` : label}
                        aria-pressed={Boolean(item)}
                        aria-busy={isPending || undefined}
                        aria-disabled={isPending}
                        data-priority={item?.priority}
                        className={clsx(
                            variant === 'poster' ? styles.bookmark : styles.priority,
                            item && styles['m-saved'],
                        )}
                        onClick={handleOpen}
                        type="button"
                    >
                        {variant === 'poster' ? (
                            <span className={styles.bookmarkIcon} data-press-surface>
                                <svg aria-hidden="true" viewBox="0 0 24 24">
                                    <path className={styles.halo} d={RIBBON} />
                                    <path d={RIBBON} />
                                </svg>
                            </span>
                        ) : (
                            <>
                                <span data-press-surface>{priorityLabel}</span>
                                <Icon name="chevron-down" />
                            </>
                        )}
                    </button>
                }
            >
                <div className={styles.editor}>
                    <div className={styles.levels} role="group" aria-label="Watchlist priority">
                        {WATCHLIST_PRIORITIES.map((priority) => (
                            <button
                                key={priority.value}
                                type="button"
                                aria-pressed={item?.priority === priority.value}
                                disabled={isPending}
                                onClick={() => save(priority.value)}
                            >
                                {priority.label}
                            </button>
                        ))}
                    </div>
                    {item ? (
                        <button
                            type="button"
                            aria-label="Remove from watchlist"
                            className={styles.remove}
                            disabled={isPending}
                            onClick={() => save(null)}
                        >
                            <Icon name="close" />
                        </button>
                    ) : null}
                    {/* The filled bookmark shows a save; only failures need visible text. */}
                    <p
                        className={
                            isPending || isSuccess || !message ? 'visually-hidden' : undefined
                        }
                        role="status"
                        ref={feedbackRef}
                        tabIndex={-1}
                    >
                        {message}
                    </p>
                </div>
            </Popover>
            <span className={clsx('visually-hidden', styles.feedback)} role="status">
                {isOpen ? '' : message}
            </span>
        </>
    );
}
