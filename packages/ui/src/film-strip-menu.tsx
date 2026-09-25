'use client';

import { Menu as MantineMenu } from '@mantine/core';
import { useEffect, useRef, useState, type FocusEvent } from 'react';

interface FilmStripMenuItemBase {
    readonly id: string;
    readonly label: string;
    readonly current?: boolean;
    readonly danger?: boolean;
}

export type FilmStripMenuItem = FilmStripMenuItemBase &
    (
        | { readonly href: string; readonly onSelect?: never }
        | { readonly href?: never; readonly onSelect: () => void }
    );

export interface FilmStripMenuProps {
    readonly triggerLabel: string;
    readonly menuLabel: string;
    readonly items: readonly FilmStripMenuItem[];
}

export function FilmStripMenu({ items, menuLabel, triggerLabel }: FilmStripMenuProps) {
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const itemsRef = useRef<Array<HTMLElement | null>>([]);

    useEffect(() => {
        if (!open) {
            return;
        }
        requestAnimationFrame(() => itemsRef.current[0]?.focus());
    }, [open]);

    function closeWhenFocusLeaves(event: FocusEvent<HTMLDivElement>): void {
        if (!event.currentTarget.contains(event.relatedTarget)) {
            setOpen(false);
        }
    }

    return (
        <div className="pf-menu" onBlur={closeWhenFocusLeaves} ref={containerRef}>
            <MantineMenu
                closeOnClickOutside
                closeOnEscape
                loop
                menuItemTabIndex={0}
                onChange={setOpen}
                opened={open}
                position="bottom-end"
                returnFocus
                trapFocus={false}
                transitionProps={{ duration: 0 }}
                unstyled
                withInitialFocusPlaceholder={false}
                withinPortal={false}
            >
                <MantineMenu.Target>
                    <button
                        className="pf-button pf-button--secondary pf-menu__trigger"
                        type="button"
                    >
                        {triggerLabel}
                    </button>
                </MantineMenu.Target>
                <MantineMenu.Dropdown aria-label={menuLabel} className="pf-film-strip">
                    {items.map((item, index) => {
                        const ref = (node: HTMLElement | null) => {
                            itemsRef.current[index] = node;
                        };

                        return item.href !== undefined ? (
                            <MantineMenu.Item
                                aria-current={item.current ? 'page' : undefined}
                                className="pf-film-strip__item"
                                component="a"
                                data-danger={item.danger || undefined}
                                href={item.href}
                                key={item.id}
                                ref={ref}
                            >
                                {item.label}
                            </MantineMenu.Item>
                        ) : (
                            <MantineMenu.Item
                                className="pf-film-strip__item"
                                component="button"
                                data-danger={item.danger || undefined}
                                key={item.id}
                                onClick={item.onSelect}
                                ref={ref}
                                type="button"
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
