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

import { Icon, type IconName } from "@pickflick/ui";

import { authClient } from "../auth/auth-client";
import styles from "./shells.module.css";

export interface ShellNavigationItem {
  readonly href: string;
  readonly label: string;
  readonly current?: boolean;
}

export interface ShellActionItem {
  readonly action: "sign-out";
  readonly label: string;
  readonly current?: never;
}

export type ShellMenuItem = ShellActionItem | ShellNavigationItem;

export interface MobileNavigationMenu {
  readonly icon: IconName;
  readonly id: string;
  readonly items: readonly ShellMenuItem[];
  /** Visible trigger text; the Hub trigger shows the current Club view. */
  readonly label: string;
  /** Stable group name used for the strip's accessible name. */
  readonly name: string;
  readonly current?: boolean;
}

export interface MobileNavigationAlerts {
  readonly id: "alerts";
  readonly label: string;
  readonly overlay: "notifications";
}

export type MobileNavigationEntry = MobileNavigationAlerts | MobileNavigationMenu;

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

function useProductOverlay() {
  const context = useContext(ProductOverlayContext);
  if (!context) {throw new Error("Product shell interactions require ProductOverlayProvider.");}
  return context;
}

/** Closes an open overlay on Escape or an outside pointer, optionally keeping Tab inside it. */
function useOverlayDismissal(
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
function useAnchoredMenus(openMenu: string | null, rootRef: RefObject<HTMLElement | null>) {
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

function NavigationItemIcon({ label }: Readonly<{ label: string }>) {
  const iconByLabel: Readonly<Record<string, IconName>> = {
    "Admin Panel": "admin",
    "Application settings": "settings",
    "Contact Us": "contact",
    "Create a Club": "overview",
    "Import & Export": "import-export",
    "Join a Club": "user-plus",
    "Manage Club": "settings",
    "My Library": "book",
    "My Ratings": "ratings",
    Achievements: "achievements",
    Clubs: "club-building",
    Manage: "settings",
    Members: "members",
    Notifications: "bell",
    Overview: "overview",
    Pricing: "pricing",
    Privacy: "privacy",
    "Privacy & data": "privacy",
    Profile: "profile",
    Ratings: "ratings",
    Sessions: "sessions",
    Settings: "settings",
    "Sign out": "sign-out",
    Subscription: "credit-card",
    Users: "members",
    Watchlist: "watchlist",
  };

  return <Icon className={styles.menuIcon} name={iconByLabel[label] ?? "circle"} />;
}

function FilmMenuItem({ item }: Readonly<{ item: ShellMenuItem }>) {
  const content = <><NavigationItemIcon label={item.label} /><b>{item.label}</b></>;

  return "href" in item ? (
    <a aria-current={item.current ? "page" : undefined} className={styles.filmFrame} href={item.href}>{content}</a>
  ) : (
    <SignOutMenuItem content={content} />
  );
}

function FilmStrip({ items, label }: Readonly<{ items: readonly ShellMenuItem[]; label: string }>) {
  return (
    <div className={styles.filmStrip}>
      <nav aria-label={label}>
        {items.map((item) => <FilmMenuItem item={item} key={item.label} />)}
      </nav>
    </div>
  );
}

function SignOutMenuItem({ content }: Readonly<{ content: ReactNode }>) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function signOut() {
    setPending(true);
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) {
        setError("Sign out failed. Please try again.");
        setPending(false);
        return;
      }
      window.location.assign("/login");
    } catch {
      setError("Sign out failed. Please try again.");
      setPending(false);
    }
  }

  return (
    <>
      <button
        aria-busy={pending || undefined}
        className={styles.filmFrame}
        data-shell-action="sign-out"
        disabled={pending}
        onClick={signOut}
        type="button"
      >
        {content}
      </button>
      {error ? <span aria-live="assertive" className={styles.signOutError} role="alert">{error}</span> : null}
    </>
  );
}

function NotificationsPanel({
  id,
  mobile = false,
  open,
  panelRef,
}: Readonly<{ id: string; mobile?: boolean; open: boolean; panelRef: RefObject<HTMLDivElement | null> }>) {
  return (
    <div
      aria-label="Notifications"
      className={mobile ? `${styles.notifPopover} ${styles.notifPopoverMobile}` : styles.notifPopover}
      data-open={open || undefined}
      id={id}
      ref={panelRef}
      role="dialog"
      tabIndex={-1}
    >
      <div className={styles.notifHeader}>
        <div>
          <h2>Notifications</h2>
          <span>You’re all caught up</span>
        </div>
        <button disabled type="button">Mark all as read</button>
      </div>
      <p className={styles.overlayEmpty}>No notifications yet.</p>
    </div>
  );
}

/** Up to two initials from the viewer's display name; empty when no usable name exists. */
function initialsFor(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/u).filter(Boolean);
  const initials = words.length > 1
    ? `${words[0]?.[0] ?? ""}${words.at(-1)?.[0] ?? ""}`
    : (words[0] ?? "").slice(0, 2);
  return initials.toUpperCase();
}

export function ProductHeaderActions({
  accountItems,
}: Readonly<{ accountItems: readonly ShellMenuItem[] }>) {
  const { activeOverlay, closeOverlay, toggleOverlay } = useProductOverlay();
  const accountRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const accountOpen = activeOverlay === "account";
  const notificationsOpen = activeOverlay === "notifications";
  const { data: session } = authClient.useSession();
  const initials = initialsFor(session?.user.name);

  useOverlayDismissal(accountOpen, accountRef, closeOverlay, true);
  useOverlayDismissal(notificationsOpen, notificationsRef, closeOverlay, true);

  useAnchoredMenus(accountOpen ? "account" : null, actionsRef);

  useEffect(() => {
    if (notificationsOpen) {notificationsRef.current?.focus({ preventScroll: true });}
  }, [notificationsOpen]);

  return (
    <div className={styles.headerActions} ref={actionsRef}>
      <button
        aria-controls="shell-search"
        aria-expanded={activeOverlay === "search"}
        aria-label="Search films"
        className={styles.roundButton}
        data-product-overlay-control
        onClick={(event) => toggleOverlay("search", event.currentTarget)}
        type="button"
      >
        <Icon className={styles.roundIcon} name="search" />
      </button>
      <div className={`${styles.popoverAnchor} ${styles.desktopHeaderAction}`}>
        <button
          aria-controls="shell-notifications"
          aria-expanded={notificationsOpen}
          aria-haspopup="dialog"
          aria-label="Notifications"
          className={styles.roundButton}
          data-product-overlay-control
          onClick={(event) => toggleOverlay("notifications", event.currentTarget)}
          type="button"
        >
          <Icon className={styles.roundIcon} name="bell" />
        </button>
        <NotificationsPanel id="shell-notifications" open={notificationsOpen} panelRef={notificationsRef} />
      </div>
      <div className={`${styles.popoverAnchor} ${styles.desktopHeaderAction}`} data-menu-anchor>
        <button
          aria-controls="shell-account-menu"
          aria-expanded={accountOpen}
          aria-label="Account menu"
          className={styles.avatarButton}
          data-product-overlay-control
          onClick={(event) => toggleOverlay("account", event.currentTarget)}
          type="button"
        >
          {initials || <Icon className={styles.roundIcon} name="profile" />}
        </button>
        <div
          className={styles.accountPopover}
          data-anchored-menu="account"
          data-open={accountOpen || undefined}
          id="shell-account-menu"
          inert={!accountOpen}
          ref={accountRef}
        >
          <span aria-hidden="true" className={styles.filmTail} />
          <FilmStrip items={accountItems} label="Account navigation" />
        </div>
      </div>
    </div>
  );
}

export function ProductSearch() {
  const { activeOverlay, closeOverlay } = useProductOverlay();
  const open = activeOverlay === "search";
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [wasOpen, setWasOpen] = useState(open);

  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {setQuery("");}
  }

  useOverlayDismissal(open, rootRef, closeOverlay, true);

  useEffect(() => {
    if (open) {inputRef.current?.focus({ preventScroll: true });}
  }, [open]);

  return (
    <div
      aria-label="Film search"
      className={styles.globalSearch}
      data-open={open || undefined}
      id="shell-search"
      inert={!open}
      ref={rootRef}
      role="search"
    >
      <div className={styles.globalSearchInner}>
        <label className="pf-visually-hidden" htmlFor="shell-search-input">Search films</label>
        <input
          autoComplete="off"
          className={`pf-control ${styles.globalSearchInput}`}
          id="shell-search-input"
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search films…"
          ref={inputRef}
          type="search"
          value={query}
        />
        <button aria-label="Close search" className={styles.searchClose} onClick={() => closeOverlay()} type="button">
          <Icon className={styles.roundIcon} name="close" />
        </button>
        <div className={styles.searchResults} role="status">
          {query.trim() ? <p className={styles.overlayEmpty}>Film search isn’t available yet.</p> : null}
        </div>
      </div>
    </div>
  );
}

export function MobileProductNavigation({
  entries,
}: Readonly<{ entries: readonly MobileNavigationEntry[] }>) {
  const { activeOverlay, closeOverlay, toggleOverlay } = useProductOverlay();
  const navigationRef = useRef<HTMLElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const activeMenu = activeOverlay?.startsWith("mobile:") ? activeOverlay.slice("mobile:".length) : null;
  const notificationsOpen = activeOverlay === "notifications-mobile";

  useOverlayDismissal(activeMenu !== null, navigationRef, closeOverlay);
  useOverlayDismissal(notificationsOpen, notificationsRef, closeOverlay, true);

  useAnchoredMenus(activeMenu, navigationRef);

  useEffect(() => {
    if (notificationsOpen) {notificationsRef.current?.focus({ preventScroll: true });}
  }, [notificationsOpen]);

  return (
    <>
      <nav aria-label="Mobile product navigation" className={styles.mobileNavigation} ref={navigationRef}>
        <div className={styles.mobileNavigationGrid}>
          {entries.map((entry) => {
            if ("overlay" in entry) {
              return (
                <div className={styles.navGroup} key={entry.id}>
                  <button
                    aria-controls="shell-notifications-mobile"
                    aria-expanded={notificationsOpen}
                    aria-haspopup="dialog"
                    className={styles.navTrigger}
                    data-product-overlay-control
                    onClick={(event) => toggleOverlay("notifications-mobile", event.currentTarget)}
                    type="button"
                  >
                    <Icon className={styles.navGlyph} name="bell" />
                    <span>{entry.label}</span>
                  </button>
                </div>
              );
            }

            const open = activeMenu === entry.id;
            return (
              <div className={styles.navGroup} data-menu-anchor data-open={open || undefined} key={entry.id}>
                <button
                  aria-controls={`mobile-${entry.id}-menu`}
                  aria-current={entry.current ? "page" : undefined}
                  aria-expanded={open}
                  className={styles.navTrigger}
                  data-product-overlay-control
                  onClick={(event) => toggleOverlay(`mobile:${entry.id}`, event.currentTarget)}
                  type="button"
                >
                  <Icon className={styles.navGlyph} name={entry.icon} />
                  <span>{entry.label}</span>
                </button>
                <div className={styles.filmMenu} data-anchored-menu={entry.id} id={`mobile-${entry.id}-menu`} inert={!open}>
                  <FilmStrip items={entry.items} label={`${entry.name} sections`} />
                  <span aria-hidden="true" className={styles.filmTail} />
                </div>
              </div>
            );
          })}
        </div>
      </nav>
      <NotificationsPanel id="shell-notifications-mobile" mobile open={notificationsOpen} panelRef={notificationsRef} />
    </>
  );
}

export function SectionNavigation({
  items,
  label,
}: Readonly<{ items: readonly ShellNavigationItem[]; label: string }>) {
  const { activeOverlay, closeOverlay, toggleOverlay } = useProductOverlay();
  const sectionId = label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
  const overlay = `section:${sectionId}` as const;
  const open = activeOverlay === overlay;
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useOverlayDismissal(open, containerRef, closeOverlay);

  useEffect(() => {
    if (open) {menuRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();}
  }, [open]);

  return (
    <>
      <aside aria-label={label} className={styles.sectionSidebar}>
        <nav>
          {items.map((item) => (
            <a aria-current={item.current ? "page" : undefined} href={item.href} key={item.label}><NavigationItemIcon label={item.label} />{item.label}</a>
          ))}
        </nav>
      </aside>
      <div className={styles.sectionMobileNavigation} ref={containerRef}>
        <button
          aria-controls={`section-${sectionId}-menu`}
          aria-expanded={open}
          className={styles.sectionMenuTrigger}
          data-product-overlay-control
          onClick={(event) => toggleOverlay(overlay, event.currentTarget)}
          type="button"
        >
          <span>{label}</span>
          <strong>{items.find((item) => item.current)?.label ?? items[0]?.label}</strong>
        </button>
        {open ? (
          <div className={styles.sectionMobileMenu} id={`section-${sectionId}-menu`} ref={menuRef}>
            <FilmStrip items={items} label={`${label} mobile`} />
          </div>
        ) : null}
      </div>
    </>
  );
}

export function BoundedScrollRegion({
  children,
  label,
}: Readonly<{ children: ReactNode; label: string }>) {
  return (
    <div
      aria-label={label}
      className={styles.denseRegion}
      onKeyDown={(event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
          return;
        }
        event.preventDefault();
        event.currentTarget.scrollLeft += event.key === "ArrowRight" ? 80 : -80;
      }}
      role="region"
      tabIndex={0}
    >
      {children}
    </div>
  );
}
