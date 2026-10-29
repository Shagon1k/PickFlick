'use client';

import type { TWatchlistItem, TWatchlistPriority } from '@pickflick/contracts';
import clsx from 'clsx';
import { useId, useRef, useState } from 'react';

import { WATCHLIST_PRIORITIES } from '#components/movies/watchlist-priority';
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
    const { message, setMessage, isPending, run } = useActionStatus();
    const label = item ? 'Edit watchlist priority' : 'Add to watchlist';

    function handleSave(priority: TWatchlistPriority | null, shouldClose = true) {
        run(() => setWatchlistAction(movieId, priority), {
            pendingMessage: 'Updating your Watchlist…',
            onResult: (result) => {
                if (!result.ok) {
                    setMessage(result.message);
                    feedbackRef.current?.focus();
                    return;
                }
                const savedMessage = priority ? 'Watchlist saved.' : 'Removed from Watchlist.';
                setMessage(savedMessage);
                if (shouldClose) setIsOpen(false);
                onSaved?.(savedMessage);
            },
        });
    }

    function handleOpen() {
        if (isPending) return;
        setIsOpen(!isOpen);
        if (!isOpen && !item) handleSave('MEDIUM', false);
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
                        aria-label={label}
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
                            <svg aria-hidden="true" viewBox="0 0 24 24">
                                <path className={styles.halo} d={RIBBON} />
                                <path d={RIBBON} />
                            </svg>
                        ) : (
                            (WATCHLIST_PRIORITIES.find(
                                (priority) => priority.value === item?.priority,
                            )?.label ?? 'Save')
                        )}
                    </button>
                }
            >
                <div className={styles.editor}>
                    <strong>Watchlist priority</strong>
                    {WATCHLIST_PRIORITIES.map((priority) => (
                        <button
                            key={priority.value}
                            type="button"
                            aria-pressed={item?.priority === priority.value}
                            disabled={isPending}
                            onClick={() => handleSave(priority.value)}
                        >
                            {priority.label}
                            <span aria-hidden="true" />
                        </button>
                    ))}
                    {item ? (
                        <button
                            type="button"
                            className={styles.remove}
                            disabled={isPending}
                            onClick={() => handleSave(null)}
                        >
                            Remove from watchlist
                        </button>
                    ) : null}
                    <p role="status" ref={feedbackRef} tabIndex={-1}>
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
