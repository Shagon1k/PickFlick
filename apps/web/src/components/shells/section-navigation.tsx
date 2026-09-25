"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { FilmStrip, NavigationItemIcon } from "./film-strip";
import { useOverlayDismissal, useProductOverlay } from "./product-overlay";
import type { ShellNavigationItem } from "./shell-navigation";
import styles from "./shells.module.css";

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
