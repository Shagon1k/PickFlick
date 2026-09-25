"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * One product overlay (search, notifications, account, or a navigation strip) is open at a time.
 * Opening another closes the first, and closing returns focus to the trigger that opened it.
 */
type HeaderOverlay = "account" | "notifications" | "notifications-mobile" | "search";
type ProductOverlay = HeaderOverlay | `mobile:${string}` | `section:${string}`;

interface ProductOverlayContextValue {
  readonly activeOverlay: ProductOverlay | null;
  readonly closeOverlay: (returnFocus?: boolean) => void;
  readonly toggleOverlay: (overlay: ProductOverlay, trigger: HTMLElement) => void;
}

const ProductOverlayContext = createContext<ProductOverlayContextValue | null>(null);

const focusableSelector =
  "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function ProductOverlayProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [activeOverlay, setActiveOverlay] = useState<ProductOverlay | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const closeOverlay = useCallback((returnFocus = true) => {
    const returnTarget = returnFocusRef.current;
    setActiveOverlay(null);
    if (returnFocus) {requestAnimationFrame(() => returnTarget?.focus());}
  }, []);

  const toggleOverlay = useCallback((overlay: ProductOverlay, trigger: HTMLElement) => {
    returnFocusRef.current = trigger;
    setActiveOverlay((current) => current === overlay ? null : overlay);
  }, []);

  const value = useMemo(
    () => ({ activeOverlay, closeOverlay, toggleOverlay }),
    [activeOverlay, closeOverlay, toggleOverlay],
  );

  return <ProductOverlayContext.Provider value={value}>{children}</ProductOverlayContext.Provider>;
}

export function useProductOverlay() {
  const context = useContext(ProductOverlayContext);
  if (!context) {throw new Error("Product shell interactions require ProductOverlayProvider.");}
  return context;
}

/** Closes an open overlay on Escape or an outside pointer, optionally keeping Tab inside it. */
export function useOverlayDismissal(
  open: boolean,
  rootRef: RefObject<HTMLElement | null>,
  closeOverlay: (returnFocus?: boolean) => void,
  trapFocus = false,
) {
  useEffect(() => {
    if (!open) {return;}

    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeOverlay();
        return;
      }
      if (!trapFocus || event.key !== "Tab") {return;}

      const root = rootRef.current;
      if (!root) {return;}
      const focusable = [...root.querySelectorAll<HTMLElement>(focusableSelector)];
      const first = focusable[0];
      const last = focusable.at(-1);
      const activeElement = document.activeElement;
      if (!first || !last) {
        event.preventDefault();
        root.focus();
      } else if (event.shiftKey && (activeElement === first || !root.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !root.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    const closeOnPointer = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        !rootRef.current?.contains(target) &&
        !target.closest("[data-product-overlay-control]")
      ) {closeOverlay(false);}
    };
    document.addEventListener("keydown", handleKeyboard);
    document.addEventListener("pointerdown", closeOnPointer);
    return () => {
      document.removeEventListener("keydown", handleKeyboard);
      document.removeEventListener("pointerdown", closeOnPointer);
    };
  }, [closeOverlay, open, rootRef, trapFocus]);
}

/** Centres a film strip on its trigger, nudging it inside the viewport when it would overflow. */
function alignToAnchor(menu: HTMLElement, anchor: HTMLElement) {
  const anchorBox = anchor.getBoundingClientRect();
  const centered = anchorBox.left + (anchorBox.width - menu.offsetWidth) / 2;
  const clamped = Math.min(Math.max(centered, 8), window.innerWidth - menu.offsetWidth - 8);
  menu.style.setProperty("--menu-shift", `${clamped - centered}px`);
}

/**
 * Keeps every `[data-anchored-menu]` inside `rootRef` aligned to its `[data-menu-anchor]` while closed,
 * so the opening transition starts from the final position, then focuses the open menu's first item.
 */
export function useAnchoredMenus(openMenu: string | null, rootRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const alignAll = () => {
      for (const menu of rootRef.current?.querySelectorAll<HTMLElement>("[data-anchored-menu]") ?? []) {
        const anchor = menu.closest<HTMLElement>("[data-menu-anchor]");
        if (anchor) {alignToAnchor(menu, anchor);}
      }
    };
    alignAll();
    window.addEventListener("resize", alignAll);
    return () => window.removeEventListener("resize", alignAll);
  }, [rootRef]);

  useEffect(() => {
    if (!openMenu) {return;}
    rootRef.current
      ?.querySelector<HTMLElement>(`[data-anchored-menu="${openMenu}"]`)
      ?.querySelector<HTMLElement>(focusableSelector)
      ?.focus({ preventScroll: true });
  }, [openMenu, rootRef]);
}
