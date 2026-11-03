'use client';

import { useId, useState } from 'react';

import Avatar from '#components/ui/Avatar/Avatar';
import Popover from '#components/ui/Popover/Popover';

import styles from './AvatarGroup.module.scss';

export interface IAvatarGroupProps {
    items: { id: string; displayName: string; avatarUrl: string | null }[];
    label: string;
}

const VISIBLE_AVATARS = 5;

export default function AvatarGroup({ items, label }: IAvatarGroupProps) {
    const id = useId();
    const [isOpen, setIsOpen] = useState(false);
    if (!items.length) return null;
    const remainingCount = items.length - VISIBLE_AVATARS;

    return (
        <Popover
            id={id}
            label={label}
            open={isOpen}
            onChange={setIsOpen}
            variant="participants"
            trigger={
                <button
                    aria-label={label}
                    className={styles.avatarGroup}
                    data-color-reveal-trigger
                    onClick={() => setIsOpen(!isOpen)}
                    type="button"
                >
                    <span aria-hidden="true" className={styles.avatarGroup__preview}>
                        {items.slice(0, VISIBLE_AVATARS).map((item) => (
                            <Avatar
                                key={item.id}
                                name={item.displayName}
                                src={item.avatarUrl}
                                size="small"
                            />
                        ))}
                        {remainingCount > 0 ? (
                            <span className={styles.avatarGroup__remaining}>+{remainingCount}</span>
                        ) : null}
                    </span>
                </button>
            }
        >
            <ul
                aria-label={label}
                className={styles.avatarGroup__list}
                tabIndex={0}
                data-color-reveal-trigger
            >
                {items.map((item) => (
                    <li className={styles.avatarGroup__member} key={item.id}>
                        <Avatar name={item.displayName} src={item.avatarUrl} size="small" />
                        <span className={styles.avatarGroup__name}>{item.displayName}</span>
                    </li>
                ))}
            </ul>
        </Popover>
    );
}
