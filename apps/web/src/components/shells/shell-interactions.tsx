"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./shells.module.css";

export interface ShellNavigationItem {
  readonly href: string;
  readonly label: string;
  readonly current?: boolean;
}

export interface MobileNavigationGroup extends ShellNavigationItem {
  readonly items?: readonly ShellNavigationItem[];
}

type HeaderOverlay = "account" | "notifications" | "search";

function Magnifier() {
  return <span aria-hidden="true" className={styles.icon}>⌕</span>;
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
  const [activeOverlay, setActiveOverlay] = useState<HeaderOverlay | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const triggers = useRef<Partial<Record<HeaderOverlay, HTMLButtonElement | null>>>({});

  function closeOverlay(returnFocus = true) {
    const previous = activeOverlay;
    setActiveOverlay(null);
    if (returnFocus && previous) {requestAnimationFrame(() => triggers.current[previous]?.focus());}
  }

  function toggleOverlay(overlay: HeaderOverlay) {
    setActiveOverlay((current) => (current === overlay ? null : overlay));
  }

  useEffect(() => {
    if (!activeOverlay) {return;}

    if (activeOverlay === "search") {searchRef.current?.focus();}
    else {containerRef.current?.querySelector<HTMLElement>("[data-shell-overlay] a, [data-shell-overlay] button")?.focus();}

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {closeOverlay();}
    };
    const closeOnPointer = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {closeOverlay(false);}
    };
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOnPointer);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("pointerdown", closeOnPointer);
    };
  }, [activeOverlay]);

  return (
    <div className={styles.headerActions} ref={containerRef}>
      <button
        aria-controls="shell-search-overlay"
        aria-expanded={activeOverlay === "search"}
        aria-label="Search films"
        className={styles.headerIconButton}
        onClick={() => toggleOverlay("search")}
        ref={(node) => { triggers.current.search = node; }}
        type="button"
      >
        <Magnifier />
      </button>
      <button
        aria-controls="shell-notifications-overlay"
        aria-expanded={activeOverlay === "notifications"}
        aria-label="Alerts"
        className={`${styles.headerIconButton} ${styles.desktopHeaderAction}`}
        onClick={() => toggleOverlay("notifications")}
        ref={(node) => { triggers.current.notifications = node; }}
        type="button"
      >
        <span aria-hidden="true" className={styles.icon}>◌</span>
      </button>
      <button
        aria-controls="shell-account-overlay"
        aria-expanded={activeOverlay === "account"}
        aria-label="Account menu"
        className={`${styles.avatarButton} ${styles.desktopHeaderAction}`}
        onClick={() => toggleOverlay("account")}
        ref={(node) => { triggers.current.account = node; }}
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
          className={`${styles.headerOverlay} ${styles.accountOverlay} ${styles.filmMenu}`}
          data-shell-overlay
          id="shell-account-overlay"
        >
          <nav aria-label="Account navigation">
            {accountItems.map((item) => <a href={item.href} key={item.label}>{item.label}</a>)}
          </nav>
        </div>
      ) : null}
    </div>
  );
}

export function MobileProductNavigation({
  groups,
}: Readonly<{ groups: readonly MobileNavigationGroup[] }>) {
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const triggers = useRef(new Map<string, HTMLButtonElement>());

  useEffect(() => {
    if (!activeGroup) {return;}
    navigationRef.current?.querySelector<HTMLElement>(`[data-mobile-menu="${activeGroup}"] a`)?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveGroup(null);
        triggers.current.get(activeGroup)?.focus();
      }
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [activeGroup]);

  return (
    <nav aria-label="Mobile product navigation" className={styles.mobileNavigation} ref={navigationRef}>
      {groups.map((group) => {
        const groupId = group.label.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-");
        const hasMenu = Boolean(group.items?.length);
        return (
          <div className={styles.mobileNavigationGroup} key={group.label}>
            {hasMenu ? (
              <button
                aria-controls={`mobile-${groupId}-menu`}
                aria-current={group.current ? "page" : undefined}
                aria-expanded={activeGroup === groupId}
                onClick={() => setActiveGroup((current) => current === groupId ? null : groupId)}
                ref={(node) => {
                  if (node) {triggers.current.set(groupId, node);}
                  else {triggers.current.delete(groupId);}
                }}
                type="button"
              >
                <span aria-hidden="true" className={styles.mobileNavGlyph}>▣</span>
                {group.label}
              </button>
            ) : (
              <a aria-current={group.current ? "page" : undefined} href={group.href}>
                <span aria-hidden="true" className={styles.mobileNavGlyph}>▣</span>
                {group.label}
              </a>
            )}
            {hasMenu && activeGroup === groupId ? (
              <div className={`${styles.mobileMenu} ${styles.filmMenu}`} data-mobile-menu={groupId} id={`mobile-${groupId}-menu`}>
                <nav aria-label={`${group.label} sections`}>
                  {group.items?.map((item) => (
                    <a aria-current={item.current ? "page" : undefined} href={item.href} key={item.label}>
                      {item.label}
                    </a>
                  ))}
                </nav>
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
            <a aria-current={item.current ? "page" : undefined} href={item.href} key={item.label}>{item.label}</a>
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
                <a aria-current={item.current ? "page" : undefined} href={item.href} key={item.label}>{item.label}</a>
              ))}
            </nav>
          </div>
        ) : null}
      </div>
    </>
  );
}
