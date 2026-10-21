'use client';

import { Menu as MantineMenu } from '@mantine/core';
import { type FocusEvent, useEffect, useRef, useState } from 'react';

import Button from '#components/ui/Button/Button';
import Icon, { type TIconName } from '#components/ui/Icon/Icon';

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
    triggerIcon?: TIconName;
}

export default function FilmStripMenu({
    items,
    menuLabel,
    triggerLabel,
    triggerIcon,
}: IFilmStripMenuProps) {
    const triggerRef = useRef<HTMLButtonElement>(null);
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
                    <Button
                        ref={triggerRef}
                        size={triggerIcon ? 'icon' : 'default'}
                        variant="secondary"
                        aria-label={triggerIcon ? triggerLabel : undefined}
                    >
                        {triggerIcon ? (
                            <Icon
                                className={styles['menu__trigger-icon']}
                                name={triggerIcon}
                                width={MENU_ICON_SIZE}
                                height={MENU_ICON_SIZE}
                            />
                        ) : (
                            triggerLabel
                        )}
                    </Button>
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
                                onClick={() => {
                                    // A dialog must return focus to the persistent trigger, not a removed menu item.
                                    triggerRef.current?.focus({ preventScroll: true });
                                    item.onSelect();
                                }}
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

const MENU_ICON_SIZE = 18;
