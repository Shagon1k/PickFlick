import type { ReactNode } from "react";

import { BrandImage, Pill, StatusBanner } from "@pickflick/ui";

import {
  BoundedScrollRegion,
  MobileProductNavigation,
  ProductHeaderActions,
  ProductOverlayProvider,
  PublicNavigation,
  SectionNavigation,
  type MobileNavigationGroup,
  type ShellActionItem,
  type ShellMenuItem,
  type ShellNavigationItem,
} from "./shell-interactions";
import styles from "./shells.module.css";

export interface ShellRouteMap {
  readonly admin: string;
  readonly contact: string;
  readonly home: string;
  readonly howItWorks: string;
  readonly library: string;
  readonly legalPrivacy: string;
  readonly legalTerms: string;
  readonly pricing: string;
  readonly privacy: string;
  readonly product: string;
  readonly session: string;
  readonly settings: string;
  readonly setup: string;
}

const canonicalRoutes: ShellRouteMap = {
  admin: "/admin",
  contact: "/contact",
  home: "/",
  howItWorks: "/#how",
  library: "/library",
  legalPrivacy: "/legal/privacy",
  legalTerms: "/legal/terms",
  pricing: "/pricing",
  privacy: "/settings?tab=privacy",
  product: "/app",
  session: "/app",
  settings: "/settings",
  setup: "/login",
};

function publicNavigation(routes: ShellRouteMap): readonly ShellNavigationItem[] {
  return [
    { href: routes.howItWorks, label: "How it works" },
    { href: routes.pricing, label: "Pricing" },
    { href: routes.contact, label: "Contact" },
  ];
}

function productNavigation(routes: ShellRouteMap): readonly ShellNavigationItem[] {
  return [
    { href: routes.product, label: "Hub" },
    { href: routes.library, label: "My Library" },
  ];
}

const signOutItem: ShellActionItem = { action: "sign-out", label: "Sign out" };

function sectionHref(route: string, tab: string): string {
  return `${route}${route.includes("?") ? "&" : "?"}tab=${tab}`;
}

function accountNavigation(routes: ShellRouteMap, admin: boolean): readonly ShellMenuItem[] {
  return [
    ...(admin ? [{ href: routes.admin, label: "Admin Panel" }] : []),
    { href: routes.settings, label: "Settings" },
    { href: routes.privacy, label: "Privacy" },
    { href: routes.pricing, label: "Pricing" },
    { href: routes.contact, label: "Contact Us" },
    signOutItem,
  ];
}

function mobileNavigation(
  routes: ShellRouteMap,
  clubItems: readonly ShellNavigationItem[],
  libraryItems?: readonly ShellNavigationItem[],
  settingsItems?: readonly ShellNavigationItem[],
): readonly MobileNavigationGroup[] {
  return [
    {
      href: routes.product,
      items: clubItems,
      label: "Hub",
    },
    {
      href: routes.library,
      items: libraryItems ?? [
        { href: sectionHref(routes.library, "my-ratings"), label: "My Ratings" },
        { href: sectionHref(routes.library, "watchlist"), label: "Watchlist" },
        { href: sectionHref(routes.library, "achievements"), label: "Achievements" },
      ],
      label: "Library",
    },
    {
      href: routes.settings,
      label: "Alerts",
      overlay: "notifications",
    },
    {
      href: routes.settings,
      items: [
        ...(settingsItems ?? [
          { href: routes.settings, label: "Profile" },
          { href: sectionHref(routes.settings, "notifications"), label: "Notifications" },
          { href: routes.privacy, label: "Privacy" },
        ]),
        signOutItem,
      ],
      label: "Settings",
    },
  ];
}

function Brand({ href = "/" }: Readonly<{ href?: string }>) {
  return (
    <a aria-label="PickFlick home" className={styles.brand} href={href}>
      <BrandImage alt="" asset="logo" loading="eager" />
      <span>PickFlick</span>
    </a>
  );
}

export function PublicShell({
  children,
  routes = canonicalRoutes,
}: Readonly<{ children: ReactNode; routes?: ShellRouteMap }>) {
  return (
    <div className={`${styles.shell} ${styles.publicShell}`} data-shell="public">
      <header className={styles.publicHeader}>
        <div className={styles.headerInner}>
          <Brand href={routes.home} />
          <PublicNavigation items={publicNavigation(routes)} />
          <a className={styles.headerCta} href={routes.setup}>Get started</a>
        </div>
      </header>
      <main>{children}</main>
      <footer className={styles.publicFooter}>
        <Brand href={routes.home} />
        <nav aria-label="Footer navigation">
          <a href={routes.legalPrivacy}>Privacy</a>
          <a href={routes.legalTerms}>Terms</a>
          <a href={routes.contact}>Contact</a>
        </nav>
        <p>PickFlick</p>
      </footer>
    </div>
  );
}

export function SetupShell({
  children,
  description,
  routes = canonicalRoutes,
  title,
}: Readonly<{ children: ReactNode; description: string; routes?: ShellRouteMap; title: string }>) {
  return (
    <div className={`${styles.shell} ${styles.setupShell}`} data-shell="setup">
      <header className={styles.compactHeader}>
        <div className={styles.headerInner}>
          <Brand href={routes.home} />
          <a className={styles.compactLink} href={routes.home}>Back to main</a>
        </div>
      </header>
      <main className={styles.setupMain}>
        <section aria-labelledby="setup-shell-title" className={styles.setupPanel}>
          <div className={styles.setupCopy}>
            <p className={styles.eyebrow}>Account setup</p>
            <h1 id="setup-shell-title">{title}</h1>
            <p>{description}</p>
          </div>
          <div className={styles.setupContent}>{children}</div>
        </section>
      </main>
    </div>
  );
}

interface ProductShellProps {
  readonly children: ReactNode;
  readonly clubItems: readonly ShellNavigationItem[];
  readonly currentArea: "admin" | "hub" | "library" | "session" | "settings";
  readonly eyebrow: string;
  readonly title: string;
  readonly admin?: boolean;
  readonly routes?: ShellRouteMap | undefined;
}

function ProductChrome({
  admin = false,
  adminItems = [],
  children,
  clubItems,
  currentArea,
  libraryItems,
  routes = canonicalRoutes,
  sessionBackHref,
  settingsItems,
}: Readonly<{
  admin?: boolean;
  adminItems?: readonly ShellNavigationItem[];
  children: ReactNode;
  clubItems: readonly ShellNavigationItem[];
  currentArea: ProductShellProps["currentArea"];
  libraryItems?: readonly ShellNavigationItem[] | undefined;
  routes?: ShellRouteMap | undefined;
  sessionBackHref?: string;
  settingsItems?: readonly ShellNavigationItem[] | undefined;
}>) {
  const desktopItems = (currentArea === "session" ? [] : productNavigation(routes)).map((item) => ({
    ...item,
    current:
      (item.label === "Hub" && ["hub", "session"].includes(currentArea)) ||
      (item.label === "My Library" && currentArea === "library"),
  }));
  const mobileItems: readonly MobileNavigationGroup[] = [
    ...mobileNavigation(
      routes,
      clubItems.map((item) => ({ ...item, current: currentArea === "hub" && item.current === true })),
      libraryItems,
      settingsItems,
    ).map((item) => ({
      ...item,
      current:
        (item.label === "Hub" && ["hub", "session"].includes(currentArea)) ||
        (item.label === "Library" && currentArea === "library") ||
        (item.label === "Settings" && currentArea === "settings"),
    })),
    ...(admin
      ? [{
          href: routes.admin,
          label: "Admin",
          current: currentArea === "admin",
          items: adminItems,
        }]
      : []),
  ];

  return (
    <ProductOverlayProvider>
      <div className={`${styles.shell} ${styles.productShell}`} data-shell={currentArea}>
        <header className={styles.productHeader}>
          <div className={styles.headerInner}>
            <Brand href={routes.product} />
            <nav aria-label="Product navigation" className={styles.productDesktopNav}>
              {desktopItems.map((item) => (
                <a aria-current={item.current ? "page" : undefined} href={item.href} key={item.label}>{item.label}</a>
              ))}
            </nav>
            <div className={styles.productHeaderControls}>
              {sessionBackHref ? <a className={`${styles.secondaryAction} ${styles.sessionHeaderBack}`} href={sessionBackHref}>← Back to Hub</a> : null}
              <ProductHeaderActions accountItems={accountNavigation(routes, admin)} />
            </div>
          </div>
        </header>
        {children}
        <MobileProductNavigation groups={mobileItems} />
      </div>
    </ProductOverlayProvider>
  );
}

export function ProductShell({ admin = false, children, clubItems, currentArea, eyebrow, routes, title }: ProductShellProps) {
  return (
    <ProductChrome admin={admin} clubItems={clubItems} currentArea={currentArea} routes={routes}>
      <main className={styles.productMain}>
        <header className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          <a className={styles.headerCta} href={routes?.session ?? canonicalRoutes.session}>Primary action</a>
        </header>
        <nav aria-label="Club sections" className={styles.contextTabs}>
          {clubItems.map((item) => (
            <a aria-current={item.current ? "page" : undefined} href={item.href} key={item.label}>{item.label}</a>
          ))}
        </nav>
        {children}
      </main>
    </ProductChrome>
  );
}

export function SessionShell({
  children,
  clubItems,
  routes,
}: Readonly<{ children: ReactNode; clubItems: readonly ShellNavigationItem[]; routes?: ShellRouteMap }>) {
  return (
    <ProductChrome
      clubItems={clubItems}
      currentArea="session"
      routes={routes}
      sessionBackHref={routes?.product ?? canonicalRoutes.product}
    >
      <main className={styles.sessionMain}>
        <StatusBanner>Session status and timing appear in this stable announced region.</StatusBanner>
        <section aria-labelledby="session-shell-title" className={styles.sessionHero}>
          <div aria-hidden="true" className={styles.posterPlaceholder}>Poster</div>
          <div className={styles.sessionHeroCopy}>
            <div className={styles.pillRow}><Pill>Session phase</Pill><Pill tone="warm">Active</Pill></div>
            <p className={styles.eyebrow}>Session detail shell</p>
            <h1 id="session-shell-title">Film and Session context</h1>
            <p>Phase-specific content inherits this shared hero, status, actions, and detail structure.</p>
            <div className={styles.actionRow}>
              <a className={styles.headerCta} href="#phase-content">Primary phase action</a>
              <a className={styles.secondaryAction} href="#session-details">Session controls</a>
            </div>
          </div>
        </section>
        <div id="phase-content">{children}</div>
      </main>
    </ProductChrome>
  );
}

interface ControlShellProps {
  readonly children: ReactNode;
  readonly clubItems: readonly ShellNavigationItem[];
  readonly currentArea: "library" | "settings";
  readonly description: string;
  readonly items: readonly ShellNavigationItem[];
  readonly routes?: ShellRouteMap;
  readonly title: string;
}

export function ControlShell({ children, clubItems, currentArea, description, items, routes, title }: ControlShellProps) {
  return (
    <ProductChrome
      clubItems={clubItems}
      currentArea={currentArea}
      libraryItems={currentArea === "library" ? items : undefined}
      routes={routes}
      settingsItems={currentArea === "settings" ? items : undefined}
    >
      <main className={styles.controlMain}>
        <header className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>Personal workspace</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
        </header>
        <SectionNavigation items={items} label={`${title} sections`} />
        <div className={styles.controlContent}>{children}</div>
      </main>
    </ProductChrome>
  );
}

export function AdminShell({
  children,
  clubItems,
  items,
  routes = canonicalRoutes,
}: Readonly<{
  children: ReactNode;
  clubItems: readonly ShellNavigationItem[];
  items: readonly ShellNavigationItem[];
  routes?: ShellRouteMap;
}>) {
  return (
    <ProductChrome admin adminItems={items} clubItems={clubItems} currentArea="admin" routes={routes}>
      <main className={`${styles.controlMain} ${styles.adminMain}`}>
        <header className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>Application control</p>
            <h1>Admin Panel</h1>
            <p>Protected operational content renders inside a distinct administration shell.</p>
          </div>
          <Pill tone="warm">App Admin</Pill>
        </header>
        <SectionNavigation items={items} label="Admin sections" />
        <div className={styles.controlContent}>{children}</div>
      </main>
    </ProductChrome>
  );
}

export function ShellPlaceholder({
  children,
  title,
}: Readonly<{ children: ReactNode; title: string }>) {
  return (
    <section aria-labelledby={`${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-title`} className={styles.placeholderPanel}>
      <h2 id={`${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-title`}>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

export function DenseRegion({ label }: Readonly<{ label: string }>) {
  return (
    <BoundedScrollRegion label={label}>
      <div className={styles.denseGrid}>
        {["Column one", "Column two", "Column three", "Column four"].map((heading) => <strong key={heading}>{heading}</strong>)}
        {Array.from({ length: 8 }, (_, index) => <span key={index}>Content</span>)}
      </div>
    </BoundedScrollRegion>
  );
}
