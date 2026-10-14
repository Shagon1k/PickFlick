'use client';

import { createContext, type RefObject, use, useEffect, useLayoutEffect } from 'react';

/**
 * One product overlay (search, notifications, account, or a navigation strip) is open at a time.
 * Opening another closes the first, and closing returns focus to the trigger that opened it.
 */
type THeaderOverlay = 'account' | 'notifications' | 'notifications-mobile' | 'search' | 'invites';
export type TProductOverlay = THeaderOverlay | `mobile:${string}` | `section:${string}`;

interface IProductOverlayContextValue {
    readonly activeOverlay: TProductOverlay | null;
    readonly closeOverlay: (returnFocus?: boolean) => void;
    readonly toggleOverlay: (overlay: TProductOverlay, trigger: HTMLElement) => void;
}

export const ProductOverlayContext = createContext<IProductOverlayContextValue | null>(null);

const FOCUSABLE_SELECTOR =
    "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function useProductOverlay() {
    const context = use(ProductOverlayContext);
    if (!context) {
        throw new Error('Product shell interactions require ProductOverlayProvider.');
    }
    return context;
}

/** Closes an open overlay on Escape or an outside pointer, optionally keeping Tab inside it. */
export function useOverlayDismissal(
    isOpen: boolean,
    rootRef: RefObject<HTMLElement | null>,
    closeOverlay: (returnFocus?: boolean) => void,
    shouldTrapFocus = false,
) {
    useEffect(() => {
        if (!isOpen) {
            return;
        }

        const handleKeyboard = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeOverlay();
                return;
            }
            if (!shouldTrapFocus || event.key !== 'Tab') {
                return;
            }

            const root = rootRef.current;
            if (!root) {
                return;
            }
            const focusable = [...root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
            const first = focusable[0];
            const last = focusable.at(-1);
            const activeElement = document.activeElement;
            if (!first || !last) {
                event.preventDefault();
                root.focus();
            } else if (
                event.shiftKey &&
                (activeElement === first || !root.contains(activeElement))
            ) {
                event.preventDefault();
                last.focus();
            } else if (
                !event.shiftKey &&
                (activeElement === last || !root.contains(activeElement))
            ) {
                event.preventDefault();
                first.focus();
            }
        };
        const closeOnPointer = (event: PointerEvent) => {
            const target = event.target;
            if (
                target instanceof Element &&
                !rootRef.current?.contains(target) &&
                !target.closest('[data-product-overlay-control]')
            ) {
                closeOverlay(false);
            }
        };
        document.addEventListener('keydown', handleKeyboard);
        document.addEventListener('pointerdown', closeOnPointer);
        return () => {
            document.removeEventListener('keydown', handleKeyboard);
            document.removeEventListener('pointerdown', closeOnPointer);
        };
    }, [closeOverlay, isOpen, rootRef, shouldTrapFocus]);
}

/** Centres a film strip on its trigger, nudging it inside the viewport when it would overflow. */
function alignToAnchor(menu: HTMLElement, anchor: HTMLElement) {
    const anchorBox = anchor.getBoundingClientRect();
    const centered = anchorBox.left + (anchorBox.width - menu.offsetWidth) / 2;
    const clamped = Math.min(Math.max(centered, 8), window.innerWidth - menu.offsetWidth - 8);
    const initialLeft =
        menu.dataset.menuAlign === 'right' ? anchorBox.right - menu.offsetWidth : centered;
    menu.style.setProperty('--menu-shift', `${clamped - initialLeft}px`);
}

/**
 * Keeps every `[data-anchored-menu]` inside `rootRef` aligned to its `[data-menu-anchor]` while closed,
 * so the opening transition starts from the final position, then focuses the open menu's first item.
 */
export function useAnchoredMenus(openMenu: string | null, rootRef: RefObject<HTMLElement | null>) {
    useLayoutEffect(() => {
        const alignAll = () => {
            for (const menu of rootRef.current?.querySelectorAll<HTMLElement>(
                '[data-anchored-menu]',
            ) ?? []) {
                const anchor = menu.closest<HTMLElement>('[data-menu-anchor]');
                if (anchor) {
                    alignToAnchor(menu, anchor);
                }
            }
        };
        alignAll();
        window.addEventListener('resize', alignAll);
        return () => window.removeEventListener('resize', alignAll);
    }, [rootRef]);

    useEffect(() => {
        if (!openMenu) {
            return;
        }
        rootRef.current
            ?.querySelector<HTMLElement>(`[data-anchored-menu="${openMenu}"]`)
            ?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
            ?.focus({ preventScroll: true });
    }, [openMenu, rootRef]);
}
