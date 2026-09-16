"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
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

export interface MobileNavigationGroup extends ShellNavigationItem {
  readonly items?: readonly ShellMenuItem[];
  readonly overlay?: "notifications";
}

type HeaderOverlay = "account" | "notifications" | "search";
type ProductOverlay = HeaderOverlay | `mobile:${string}` | `section:${string}`;

interface ProductOverlayContextValue {
  readonly activeOverlay: ProductOverlay | null;
  readonly closeOverlay: (returnFocus?: boolean) => void;
  readonly toggleOverlay: (overlay: ProductOverlay, trigger: HTMLElement) => void;
}

const ProductOverlayContext = createContext<ProductOverlayContextValue | null>(null);

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

function Magnifier() {
  return <Icon className={styles.icon} name="search" />;
}

function Bell() {
  return <Icon className={styles.icon} name="bell" />;
}

function MobileNavigationIcon({ label }: Readonly<{ label: string }>) {
  const iconByLabel: Readonly<Record<string, IconName>> = {
    Admin: "admin",
    Alerts: "bell",
    Hub: "hub",
    Library: "library",
    Settings: "settings",
  };

  return <Icon className={styles.mobileNavGlyph} name={iconByLabel[label] ?? "circle"} />;
}

function NavigationItemIcon({ label }: Readonly<{ label: string }>) {
  const iconByLabel: Readonly<Record<string, IconName>> = {
    "Admin Panel": "admin",
    "Application settings": "settings",
    "Contact Us": "contact",
    "Import & Export": "import-export",
    "My Ratings": "ratings",
    Achievements: "achievements",
    Clubs: "club-building",
    Manage: "settings",
    "Manage Club": "settings",
    Members: "members",
    Notifications: "bell",
    Overview: "overview",
    Pricing: "pricing",
    Privacy: "privacy",
    Profile: "profile",
    Ratings: "ratings",
    Sessions: "sessions",
    Settings: "settings",
    "Sign out": "sign-out",
    Subscription: "pricing",
    Users: "members",
    Watchlist: "watchlist",
  };

  return <Icon className={styles.menuIcon} name={iconByLabel[label] ?? "circle"} />;
}

function FilmMenuItem({ item }: Readonly<{ item: ShellMenuItem }>) {
  const content = <><NavigationItemIcon label={item.label} />{item.label}</>;

  return "href" in item ? (
    <a aria-current={item.current ? "page" : undefined} href={item.href}>{content}</a>
  ) : (
    <SignOutMenuItem content={content} />
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
      <button aria-busy={pending || undefined} data-shell-action="sign-out" disabled={pending} onClick={signOut} type="button">
        {content}
      </button>
      {error ? <span aria-live="assertive" className="pf-visually-hidden" role="alert">{error}</span> : null}
    </>
  );
}

export function PublicNavigation({
  items,
  variant,
}: Readonly<{
  items: readonly ShellNavigationItem[];
  variant: "desktop" | "mobile";
}>) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {return;}

    menuRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <>
      {variant === "desktop" ? (
        <nav aria-label="Public navigation" className={styles.publicDesktopNav}>
          {items.map((item) => (
            <a aria-current={item.current ? "page" : undefined} href={item.href} key={item.label}>
              {item.label}
            </a>
          ))}
        </nav>
      ) : (
        <div className={styles.publicMobileNav}>
        <button
          aria-controls="public-mobile-navigation"
          aria-expanded={open}
          className={styles.headerButton}
          onClick={() => setOpen((current) => !current)}
          ref={triggerRef}
          type="button"
        >
          <Icon className={styles.publicMenuIcon} name="menu" />
          <span>Menu</span>
        </button>
        {open ? (
          <div
            className={styles.filmMenu}
            id="public-mobile-navigation"
            onBlur={(event) => {
              if (
                event.relatedTarget !== triggerRef.current &&
                !event.currentTarget.contains(event.relatedTarget)
              ) {setOpen(false);}
            }}
            ref={menuRef}
          >
            <nav aria-label="Public mobile navigation">
              {items.map((item) => (
                <a aria-current={item.current ? "page" : undefined} href={item.href} key={item.label}>
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        ) : null}
        </div>
      )}
    </>
  );
}

export function ProductHeaderActions({
  accountItems,
}: Readonly<{ accountItems: readonly ShellMenuItem[] }>) {
  const { activeOverlay, closeOverlay, toggleOverlay } = useProductOverlay();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (
      activeOverlay !== "account" &&
      activeOverlay !== "notifications" &&
      activeOverlay !== "search"
    ) {return;}

    if (activeOverlay === "search") {searchRef.current?.focus();}
    else {containerRef.current?.querySelector<HTMLElement>("[data-shell-overlay] a, [data-shell-overlay] button")?.focus();}

    const handleKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeOverlay();
        return;
      }
      if (event.key !== "Tab") {return;}

      const overlay = containerRef.current?.querySelector<HTMLElement>("[data-shell-overlay]");
      const focusable = overlay ? [...overlay.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
      )] : [];
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!overlay || !first || !last) {return;}

      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || !overlay.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !overlay.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    const closeOnPointer = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        !containerRef.current?.contains(target) &&
        !target.closest("[data-product-overlay-control]")
      ) {closeOverlay(false);}
    };
    document.addEventListener("keydown", handleKeyboard);
    document.addEventListener("pointerdown", closeOnPointer);
    return () => {
      document.removeEventListener("keydown", handleKeyboard);
      document.removeEventListener("pointerdown", closeOnPointer);
    };
  }, [activeOverlay, closeOverlay]);

  return (
    <div className={styles.headerActions} ref={containerRef}>
      <button
        aria-controls="shell-search-overlay"
        aria-expanded={activeOverlay === "search"}
        aria-label="Search films"
        className={styles.headerIconButton}
        data-product-overlay-control
        onClick={(event) => toggleOverlay("search", event.currentTarget)}
        type="button"
      >
        <Magnifier />
      </button>
      <button
        aria-controls="shell-notifications-overlay"
        aria-expanded={activeOverlay === "notifications"}
        aria-label="Alerts"
        className={`${styles.headerIconButton} ${styles.desktopHeaderAction}`}
        data-product-overlay-control
        onClick={(event) => toggleOverlay("notifications", event.currentTarget)}
        type="button"
      >
        <Bell />
        <span aria-hidden="true" className={styles.alertBadge} />
      </button>
      <button
        aria-controls="shell-account-overlay"
        aria-expanded={activeOverlay === "account"}
        aria-label="Account menu"
        className={`${styles.avatarButton} ${styles.desktopHeaderAction}`}
        data-product-overlay-control
        onClick={(event) => toggleOverlay("account", event.currentTarget)}
        type="button"
      >
        PF
      </button>

      {activeOverlay === "search" ? (
        <section
          aria-label="Film search"
          className={`${styles.headerOverlay} ${styles.searchOverlay}`}
          data-shell-overlay
          id="shell-search-overlay"
        >
          <label className={styles.overlayLabel} htmlFor="shell-search-input">Search films</label>
          <div className={styles.searchRow}>
            <input className="pf-control" id="shell-search-input" placeholder="Film title" ref={searchRef} type="search" />
            <button aria-label="Close search" className={styles.headerButton} onClick={() => closeOverlay()} type="button">Close</button>
          </div>
          <p className={styles.overlayHint}>Search results render in this bounded region.</p>
        </section>
      ) : null}

      {activeOverlay === "notifications" ? (
        <section
          aria-label="Alerts"
          className={styles.headerOverlay}
          data-shell-overlay
          id="shell-notifications-overlay"
        >
          <div className={styles.overlayHeading}>
            <strong>Alerts</strong>
            <button className={styles.textButton} type="button">Mark all as read</button>
          </div>
          <p className={styles.overlayHint}>Notification states render here without shifting the header.</p>
        </section>
      ) : null}

      {activeOverlay === "account" ? (
        <div
          className={`${styles.headerOverlay} ${styles.accountOverlay}`}
          data-shell-overlay
          id="shell-account-overlay"
        >
          <span aria-hidden="true" className={styles.filmTail} />
          <div className={styles.filmMenu}>
            <nav aria-label="Account navigation">
              {accountItems.map((item) => <FilmMenuItem item={item} key={item.label} />)}
            </nav>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function MobileProductNavigation({
  groups,
}: Readonly<{ groups: readonly MobileNavigationGroup[] }>) {
  const { activeOverlay, closeOverlay, toggleOverlay } = useProductOverlay();
  const navigationRef = useRef<HTMLElement>(null);
  const activeGroup = activeOverlay?.startsWith("mobile:") ? activeOverlay.slice("mobile:".length) : null;

  useEffect(() => {
    if (!activeGroup) {return;}
    navigationRef.current?.querySelector<HTMLElement>(`[data-mobile-menu="${activeGroup}"] a, [data-mobile-menu="${activeGroup}"] button`)?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeOverlay();
      }
    };
    const closeOnPointer = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        !navigationRef.current?.contains(target) &&
        !target.closest("[data-product-overlay-control]")
      ) {closeOverlay(false);}
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnPointer);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnPointer);
    };
  }, [activeGroup, closeOverlay]);

  return (
    <nav aria-label="Mobile product navigation" className={styles.mobileNavigation} ref={navigationRef}>
      {groups.map((group) => {
        const groupId = group.label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
        const hasMenu = Boolean(group.items?.length);
        const controls = group.overlay === "notifications" ? "shell-notifications-overlay" : `mobile-${groupId}-menu`;
        const overlay = group.overlay ?? `mobile:${groupId}`;
        return (
          <div className={styles.mobileNavigationGroup} key={group.label}>
            {hasMenu || group.overlay ? (
              <button
                aria-controls={controls}
                aria-current={group.current ? "page" : undefined}
                aria-expanded={activeOverlay === overlay}
                data-product-overlay-control
                onClick={(event) => toggleOverlay(overlay, event.currentTarget)}
                type="button"
              >
                <MobileNavigationIcon label={group.label} />
                {group.overlay === "notifications" ? <span aria-hidden="true" className={styles.alertBadge} /> : null}
                {group.label}
              </button>
            ) : (
              <a aria-current={group.current ? "page" : undefined} href={group.href}>
                <MobileNavigationIcon label={group.label} />
                {group.label}
              </a>
            )}
            {hasMenu && activeGroup === groupId ? (
              <div className={styles.mobileMenu} data-mobile-menu={groupId} id={`mobile-${groupId}-menu`}>
                <div className={styles.filmMenu}>
                  <nav aria-label={`${group.label} sections`}>
                    {group.items?.map((item) => (
                      <FilmMenuItem item={item} key={item.label} />
                    ))}
                  </nav>
                </div>
                <span aria-hidden="true" className={styles.filmTail} />
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
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
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    menuRef.current?.querySelector<HTMLAnchorElement>("a")?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeOverlay();
      }
    };
    const closeOnPointer = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        !containerRef.current?.contains(target) &&
        !target.closest("[data-product-overlay-control]")
      ) {closeOverlay(false);}
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnPointer);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnPointer);
    };
  }, [closeOverlay, open]);

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
          ref={triggerRef}
          type="button"
        >
          <span>{label}</span>
          <strong>{items.find((item) => item.current)?.label ?? items[0]?.label}</strong>
        </button>
        {open ? (
          <div
            className={`${styles.sectionMobileMenu} ${styles.filmMenu}`}
            id={`section-${sectionId}-menu`}
            ref={menuRef}
          >
            <nav aria-label={`${label} mobile`}>
              {items.map((item) => (
                <a aria-current={item.current ? "page" : undefined} href={item.href} key={item.label}><NavigationItemIcon label={item.label} />{item.label}</a>
              ))}
            </nav>
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
