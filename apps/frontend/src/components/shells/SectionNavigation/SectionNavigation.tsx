'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';

import FilmStrip from '#components/shells/FilmStrip/FilmStrip';
import NavigationItemIcon from '#components/shells/NavigationItemIcon/NavigationItemIcon';
import styles from '#components/shells/product-navigation.module.scss';
import { useOverlayDismissal, useProductOverlay } from '#components/shells/product-overlay';
import type { IShellNavigationItem } from '#components/shells/shell-navigation';

interface ISectionNavigationProps {
    items: readonly IShellNavigationItem[];
    label: string;
}

export default function SectionNavigation({ items, label }: ISectionNavigationProps) {
    const { activeOverlay, closeOverlay, toggleOverlay } = useProductOverlay();
    const sectionId = label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
    const overlay = `section:${sectionId}` as const;
    const isOpen = activeOverlay === overlay;
    const containerRef = useRef<HTMLDivElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    useOverlayDismissal(isOpen, containerRef, closeOverlay);

    useEffect(() => {
        if (isOpen) {
            menuRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();
        }
    }, [isOpen]);

    return (
        <>
            <aside aria-label={label} className={styles.sectionSidebar}>
                <nav>
                    {items.map((item) => (
                        <Link
                            aria-current={item.current ? 'page' : undefined}
                            href={item.href}
                            key={item.label}
                        >
                            <NavigationItemIcon label={item.label} />
                            {item.label}
                        </Link>
                    ))}
                </nav>
            </aside>
            <div className={styles.sectionMobileNavigation} ref={containerRef}>
                <button
                    aria-controls={`section-${sectionId}-menu`}
                    aria-expanded={isOpen}
                    className={styles.sectionMenuTrigger}
                    data-product-overlay-control
                    onClick={(event) => toggleOverlay(overlay, event.currentTarget)}
                    type="button"
                >
                    <span>{label}</span>
                    <strong>{items.find((item) => item.current)?.label ?? items[0]?.label}</strong>
                </button>
                {isOpen ? (
                    <div
                        className={styles.sectionMobileMenu}
                        id={`section-${sectionId}-menu`}
                        ref={menuRef}
                    >
                        <FilmStrip items={items} label={`${label} mobile`} />
                    </div>
                ) : null}
            </div>
        </>
    );
}
