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

import styles from "./shells.module.css";

export interface ShellNavigationItem {
  readonly href: string;
  readonly label: string;
  readonly current?: boolean;
}

export interface MobileNavigationGroup extends ShellNavigationItem {
  readonly items?: readonly ShellNavigationItem[];
  readonly overlay?: "notifications";
}

type HeaderOverlay = "account" | "notifications" | "search";
type ProductOverlay = HeaderOverlay | `mobile:${string}`;

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
  return (
    <svg aria-hidden="true" className={styles.icon} fill="none" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.35-4.35" />
    </svg>
  );
}

function Bell() {
  return (
    <svg aria-hidden="true" className={styles.icon} fill="none" viewBox="0 0 24 24">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

function MobileNavigationIcon({ label }: Readonly<{ label: string }>) {
  const common = { "aria-hidden": true, className: styles.mobileNavGlyph, fill: "none", viewBox: "0 0 24 24" } as const;
  switch (label) {
    case "Hub":
      return <svg {...common}><path d="M4 6h16v14H4zM4 10h16M8 3l2 3m4-3 2 3" /></svg>;
    case "Library":
      return <svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2" /><path d="M12 4v3m0 10v3m8-8h-3M7 12H4" /></svg>;
    case "Alerts":
      return <Bell />;
    case "Settings":
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2.9 2.9-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21h-4v-.1a1.7 1.7 0 0 0-2.8-1.2l-.1.1-2.9-2.9.1-.1A1.7 1.7 0 0 0 4.6 14H4v-4h.1a1.7 1.7 0 0 0 1.2-2.8l-.1-.1 2.9-2.9.1.1A1.7 1.7 0 0 0 11 3.1V3h4v.1a1.7 1.7 0 0 0 2.8 1.2l.1-.1 2.9 2.9-.1.1a1.7 1.7 0 0 0 1.2 2.8h.1v4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
    case "Admin":
      return <svg {...common}><path d="M12 3l8 4v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V7z" /><path d="m9 12 2 2 4-4" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
  }
}

function NavigationItemIcon({ label }: Readonly<{ label: string }>) {
  const common = { "aria-hidden": true, className: styles.menuIcon, fill: "none", viewBox: "0 0 24 24" } as const;
  switch (label) {
    case "Overview":
      return <svg {...common}><rect height="7" width="7" x="3" y="3" /><rect height="7" width="7" x="14" y="3" /><rect height="7" width="7" x="3" y="14" /><rect height="7" width="7" x="14" y="14" /></svg>;
    case "Sessions":
      return <svg {...common}><path d="M4 6h16v14H4zM4 10h16M8 3l2 3m4-3 2 3" /></svg>;
    case "Ratings":
    case "My Ratings":
      return <svg {...common}><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" /></svg>;
    case "Members":
    case "Users":
      return <svg {...common}><circle cx="9" cy="8" r="4" /><path d="M2 21v-2a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v2m1-11a4 4 0 0 1 4 4v2" /></svg>;
    case "Achievements":
      return <svg {...common}><circle cx="12" cy="9" r="6" /><path d="m8 14-1 7 5-3 5 3-1-7" /></svg>;
    case "Watchlist":
      return <svg {...common}><path d="M6 3h12v18l-6-4-6 4z" /></svg>;
    case "Profile":
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
    case "Notifications":
      return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>;
    case "Privacy":
      return <svg {...common}><rect height="10" rx="2" width="18" x="3" y="11" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>;
    case "Subscription":
    case "Pricing":
      return <svg {...common}><path d="M12 2v20m5-16H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H7" /></svg>;
    case "Import & Export":
      return <svg {...common}><path d="M8 3H4v16h4m8-16h4v16h-4M7 8l5-5 5 5m-5-5v13m5 0-5 5-5-5" /></svg>;
    case "Clubs":
      return <svg {...common}><path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6" /></svg>;
    case "Admin Panel":
      return <svg {...common}><path d="M12 3l8 4v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V7z" /><path d="m9 12 2 2 4-4" /></svg>;
    case "Contact Us":
      return <svg {...common}><rect height="16" rx="2" width="20" x="2" y="4" /><path d="m2 6 10 7 10-7" /></svg>;
    case "Manage Club":
    case "Application settings":
    case "Settings":
      return <svg {...common}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2.9 2.9-.1-.1a1.7 1.7 0 0 0-2.8 1.2V21h-4v-.1a1.7 1.7 0 0 0-2.8-1.2l-.1.1-2.9-2.9.1-.1A1.7 1.7 0 0 0 4.6 14H4v-4h.1a1.7 1.7 0 0 0 1.2-2.8l-.1-.1 2.9-2.9.1.1A1.7 1.7 0 0 0 11 3.1V3h4v.1a1.7 1.7 0 0 0 2.8 1.2l.1-.1 2.9 2.9-.1.1a1.7 1.7 0 0 0 1.2 2.8h.1v4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="7" /></svg>;
  }
}

export function PublicNavigation({ items }: Readonly<{ items: readonly ShellNavigationItem[] }>) {
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
      <nav aria-label="Public navigation" className={styles.publicDesktopNav}>
        {items.map((item) => (
          <a aria-current={item.current ? "page" : undefined} href={item.href} key={item.label}>
            {item.label}
          </a>
        ))}
      </nav>
      <div className={styles.publicMobileNav}>
        <button
          aria-controls="public-mobile-navigation"
          aria-expanded={open}
          className={styles.headerButton}
          onClick={() => setOpen((current) => !current)}
          ref={triggerRef}
          type="button"
        >
          Menu
        </button>
        {open ? (
          <div
            className={styles.filmMenu}
            id="public-mobile-navigation"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {setOpen(false);}
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
    </>
  );
}

export function ProductHeaderActions({
  accountItems,
}: Readonly<{ accountItems: readonly ShellNavigationItem[] }>) {
  const { activeOverlay, closeOverlay, toggleOverlay } = useProductOverlay();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!activeOverlay || activeOverlay.startsWith("mobile:")) {return;}

    if (activeOverlay === "search") {searchRef.current?.focus();}
    else {containerRef.current?.querySelector<HTMLElement>("[data-shell-overlay] a, [data-shell-overlay] button")?.focus();}

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {closeOverlay();}
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
              {accountItems.map((item) => <a href={item.href} key={item.label}><NavigationItemIcon label={item.label} />{item.label}</a>)}
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
    navigationRef.current?.querySelector<HTMLElement>(`[data-mobile-menu="${activeGroup}"] a`)?.focus();
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
                      <a aria-current={item.current ? "page" : undefined} href={item.href} key={item.label}>
                        <NavigationItemIcon label={item.label} />
                        {item.label}
                      </a>
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
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
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
      <aside aria-label={label} className={styles.sectionSidebar}>
        <nav>
          {items.map((item) => (
            <a aria-current={item.current ? "page" : undefined} href={item.href} key={item.label}><NavigationItemIcon label={item.label} />{item.label}</a>
          ))}
        </nav>
      </aside>
      <div className={styles.sectionMobileNavigation}>
        <button
          aria-controls="section-mobile-menu"
          aria-expanded={open}
          className={styles.sectionMenuTrigger}
          onClick={() => setOpen((current) => !current)}
          ref={triggerRef}
          type="button"
        >
          <span>{label}</span>
          <strong>{items.find((item) => item.current)?.label ?? items[0]?.label}</strong>
        </button>
        {open ? (
          <div
            className={`${styles.sectionMobileMenu} ${styles.filmMenu}`}
            id="section-mobile-menu"
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
