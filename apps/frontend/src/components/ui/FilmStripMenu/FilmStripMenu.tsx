'use client';

import { Menu as MantineMenu } from '@mantine/core';
import { type FocusEvent, useEffect, useRef, useState } from 'react';

import Button from '#components/ui/Button/Button';

import styles from './FilmStripMenu.module.scss';

interface IFilmStripMenuItemBase {
    id: string;
    label: string;
    current?: boolean;
    danger?: boolean;
}

type TFilmStripMenuItem = IFilmStripMenuItemBase &
    ({ href: string; onSelect?: never } | { href?: never; onSelect: () => void });

export interface IFilmStripMenuProps {
    triggerLabel: string;
    menuLabel: string;
    items: TFilmStripMenuItem[];
}

export default function FilmStripMenu({ items, menuLabel, triggerLabel }: IFilmStripMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const itemsRef = useRef<Array<HTMLElement | null>>([]);

    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => itemsRef.current[0]?.focus());
        }
    }, [isOpen]);

    function handleMenuBlur(event: FocusEvent<HTMLDivElement>): void {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsOpen(false);
        }
    }

    return (
        <div className={styles.menu} onBlur={handleMenuBlur}>
            <MantineMenu
                closeOnClickOutside
                closeOnEscape
                loop
                menuItemTabIndex={0}
                onChange={setIsOpen}
                opened={isOpen}
                position="bottom-end"
                returnFocus
                trapFocus={false}
                transitionProps={{ duration: 0 }}
                unstyled
                withInitialFocusPlaceholder={false}
                withinPortal={false}
            >
                <MantineMenu.Target>
                    <Button variant="secondary">{triggerLabel}</Button>
                </MantineMenu.Target>
                <MantineMenu.Dropdown aria-label={menuLabel} className={styles.menu__dropdown}>
                    {items.map((item, index) => {
                        const ref = (node: HTMLElement | null) => {
                            itemsRef.current[index] = node;
                        };
                        return item.href === undefined ? (
                            <MantineMenu.Item
                                className={styles.menu__item}
                                component="button"
                                data-danger={item.danger || undefined}
                                key={item.id}
                                onClick={item.onSelect}
                                ref={ref}
                                type="button"
                            >
                                {item.label}
                            </MantineMenu.Item>
                        ) : (
                            <MantineMenu.Item
                                aria-current={item.current ? 'page' : undefined}
                                className={styles.menu__item}
                                component="a"
                                data-danger={item.danger || undefined}
                                href={item.href}
                                key={item.id}
                                ref={ref}
                            >
                                {item.label}
                            </MantineMenu.Item>
                        );
                    })}
                </MantineMenu.Dropdown>
            </MantineMenu>
        </div>
    );
}
