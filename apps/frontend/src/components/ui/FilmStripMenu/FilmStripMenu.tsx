'use client';

import { Menu as MantineMenu } from '@mantine/core';
import { type FocusEvent, useEffect, useRef, useState } from 'react';

import Button from '#components/ui/Button/Button';
import Icon, { type TIconName } from '#components/ui/Icon/Icon';

import styles from './FilmStripMenu.module.scss';

interface IFilmStripMenuItemBase {
    id: string;
    label: string;
    icon: TIconName;
    current?: boolean;
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
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => {
                // Short screens scroll the whole strip clear of the fixed bottom bar.
                dropdownRef.current?.scrollIntoView({ block: 'nearest' });
                itemsRef.current[0]?.focus({ preventScroll: true });
            });
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
                offset={MENU_OFFSET}
                position="bottom"
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
                <MantineMenu.Dropdown
                    aria-label={menuLabel}
                    className={styles.menu__dropdown}
                    ref={dropdownRef}
                >
                    <span aria-hidden="true" className={styles.menu__tail} />
                    <div className={styles.menu__strip}>
                        {items.map((item, index) => {
                            const ref = (node: HTMLElement | null) => {
                                itemsRef.current[index] = node;
                            };
                            const icon = (
                                <Icon
                                    className={styles['menu__item-icon']}
                                    name={item.icon}
                                    width={ITEM_ICON_SIZE}
                                    height={ITEM_ICON_SIZE}
                                />
                            );
                            return item.href === undefined ? (
                                <MantineMenu.Item
                                    className={styles.menu__item}
                                    component="button"
                                    key={item.id}
                                    leftSection={icon}
                                    onClick={() => {
                                        // A dialog must return focus to the persistent trigger, not a removed menu item.
                                        triggerRef.current?.focus({ preventScroll: true });
                                        item.onSelect();
                                    }}
                                    ref={ref}
                                    type="button"
                                >
                                    <b>{item.label}</b>
                                </MantineMenu.Item>
                            ) : (
                                <MantineMenu.Item
                                    aria-current={item.current ? 'page' : undefined}
                                    className={styles.menu__item}
                                    component="a"
                                    href={item.href}
                                    key={item.id}
                                    leftSection={icon}
                                    ref={ref}
                                >
                                    <b>{item.label}</b>
                                </MantineMenu.Item>
                            );
                        })}
                    </div>
                </MantineMenu.Dropdown>
            </MantineMenu>
        </div>
    );
}

// Leaves room above the strip for its tail tab.
const MENU_OFFSET = 14;
const MENU_ICON_SIZE = 18;
const ITEM_ICON_SIZE = 20;
