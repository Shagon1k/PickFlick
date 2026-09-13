import type { ReactNode } from "react";

import { BrandImage, Pill, StatusBanner } from "@pickflick/ui";

import {
  MobileProductNavigation,
  ProductHeaderActions,
  PublicNavigation,
  SectionNavigation,
  type MobileNavigationGroup,
  type ShellNavigationItem,
} from "./shell-interactions";
import styles from "./shells.module.css";

export interface ShellRouteMap {
  readonly admin: string;
  readonly contact: string;
  readonly home: string;
  readonly library: string;
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
  library: "/library",
  pricing: "/pricing",
  privacy: "/settings/privacy",
  product: "/clubs",
  session: "/sessions",
  settings: "/settings",
  setup: "/login",
};

function publicNavigation(routes: ShellRouteMap): readonly ShellNavigationItem[] {
  return [
    { href: routes.home, label: "How it works" },
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

function accountNavigation(routes: ShellRouteMap): readonly ShellNavigationItem[] {
  return [
    { href: routes.admin, label: "Admin Panel" },
    { href: routes.settings, label: "Settings" },
    { href: routes.privacy, label: "Privacy" },
    { href: routes.pricing, label: "Pricing" },
    { href: routes.contact, label: "Contact Us" },
  ];
}

function mobileNavigation(routes: ShellRouteMap): readonly MobileNavigationGroup[] {
  return [
    {
      href: routes.product,
      items: [
        { href: routes.product, label: "Overview" },
        { href: routes.session, label: "Sessions" },
        { href: routes.product, label: "Ratings" },
        { href: routes.product, label: "Members" },
      ],
      label: "Hub",
    },
    {
      href: routes.library,
      items: [
        { href: routes.library, label: "My Ratings" },
        { href: routes.library, label: "Watchlist" },
        { href: routes.library, label: "Achievements" },
      ],
      label: "Library",
    },
    {
      href: routes.product,
      items: [{ href: routes.product, label: "Notification state" }],
      label: "Alerts",
    },
    {
      href: routes.settings,
      items: [
        { href: routes.settings, label: "Profile" },
        { href: routes.settings, label: "Notifications" },
        { href: routes.privacy, label: "Privacy" },
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
          <a href={routes.privacy}>Privacy</a>
          <a href={routes.privacy}>Terms</a>
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
  readonly currentArea: "admin" | "hub" | "library" | "session" | "settings";
  readonly eyebrow: string;
  readonly title: string;
  readonly admin?: boolean;
  readonly routes?: ShellRouteMap | undefined;
}

function ProductChrome({
  admin = false,
  children,
  currentArea,
  routes = canonicalRoutes,
}: Readonly<Pick<ProductShellProps, "admin" | "children" | "currentArea" | "routes">>) {
  const desktopItems = productNavigation(routes).map((item) => ({
    ...item,
    current:
      (item.label === "Hub" && ["hub", "session"].includes(currentArea)) ||
      (item.label === "My Library" && currentArea === "library"),
  }));
  const mobileItems = [
    ...mobileNavigation(routes).map((item) => ({
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
          items: [
            { href: routes.admin, label: "Overview", current: true },
            { href: routes.admin, label: "Users" },
            { href: routes.admin, label: "Clubs" },
            { href: routes.admin, label: "Application settings" },
          ],
        }]
      : []),
  ];

  return (
    <div className={`${styles.shell} ${styles.productShell}`} data-shell={currentArea}>
      <header className={styles.productHeader}>
        <div className={styles.headerInner}>
          <Brand href={routes.product} />
          <nav aria-label="Product navigation" className={styles.productDesktopNav}>
            {desktopItems.map((item) => (
              <a aria-current={item.current ? "page" : undefined} href={item.href} key={item.label}>{item.label}</a>
            ))}
          </nav>
          <ProductHeaderActions accountItems={accountNavigation(routes)} />
        </div>
      </header>
      {children}
      <MobileProductNavigation groups={mobileItems} />
    </div>
  );
}

export function ProductShell({ children, currentArea, eyebrow, routes, title }: ProductShellProps) {
  return (
    <ProductChrome currentArea={currentArea} routes={routes}>
      <main className={styles.productMain}>
        <header className={styles.pageHeading}>
          <div>
            <p className={styles.eyebrow}>{eyebrow}</p>
            <h1>{title}</h1>
          </div>
          <a className={styles.headerCta} href={routes?.setup ?? canonicalRoutes.setup}>Primary action</a>
        </header>
        <nav aria-label="Club sections" className={styles.contextTabs}>
          {["Overview", "Sessions", "Ratings", "Members", "Achievements", "Manage Club"].map((label, index) => (
            <a aria-current={index === 0 ? "page" : undefined} href={routes?.product ?? canonicalRoutes.product} key={label}>{label}</a>
          ))}
        </nav>
        {children}
      </main>
    </ProductChrome>
  );
}

export function SessionShell({ children, routes }: Readonly<{ children: ReactNode; routes?: ShellRouteMap }>) {
  return (
    <ProductChrome currentArea="session" routes={routes}>
      <main className={styles.sessionMain}>
        <a className={styles.backLink} href={routes?.product ?? canonicalRoutes.product}>← Back to Hub</a>
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
  readonly currentArea: "library" | "settings";
  readonly description: string;
  readonly items: readonly ShellNavigationItem[];
  readonly routes?: ShellRouteMap;
  readonly title: string;
}

export function ControlShell({ children, currentArea, description, items, routes, title }: ControlShellProps) {
  return (
    <ProductChrome currentArea={currentArea} routes={routes}>
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

export function AdminShell({ children, routes = canonicalRoutes }: Readonly<{ children: ReactNode; routes?: ShellRouteMap }>) {
  const items = [
    { href: routes.admin, label: "Overview", current: true },
    { href: routes.admin, label: "Users" },
    { href: routes.admin, label: "Clubs" },
    { href: routes.admin, label: "Application settings" },
  ] as const;

  return (
    <ProductChrome admin currentArea="admin" routes={routes}>
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
    <div aria-label={label} className={styles.denseRegion} role="region" tabIndex={0}>
      <div className={styles.denseGrid}>
        {["Column one", "Column two", "Column three", "Column four"].map((heading) => <strong key={heading}>{heading}</strong>)}
        {Array.from({ length: 8 }, (_, index) => <span key={index}>Content</span>)}
      </div>
    </div>
  );
}
