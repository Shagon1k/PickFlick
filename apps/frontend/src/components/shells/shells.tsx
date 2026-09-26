import { Fragment, type ReactNode } from 'react';

import { MobileProductNavigation } from '@/components/shells/mobile-navigation';
import { ProductHeaderActions, ProductSearch } from '@/components/shells/product-header';
import { ProductOverlayProvider } from '@/components/shells/product-overlay';
import { BoundedScrollRegion, SectionNavigation } from '@/components/shells/section-navigation';
import {
    accountNavigation,
    canonicalRoutes,
    type IShellNavigationItem,
    type IShellRouteMap,
    mobileNavigation,
    productNavigation,
    publicNavigation,
    type TShellArea,
} from '@/components/shells/shell-navigation';
import styles from '@/components/shells/shells.module.scss';
import BrandImage from '@/components/ui/BrandImage/BrandImage';
import ButtonLink from '@/components/ui/Button/ButtonLink';
import Pill from '@/components/ui/Pill/Pill';
import StatusBanner from '@/components/ui/StatusBanner/StatusBanner';

function Brand({ href = '/' }: { href?: string }) {
    return (
        <a aria-label="PickFlick home" className={styles.brand} href={href}>
            <BrandImage alt="" asset="logo" loading="eager" />
            <span>PickFlick</span>
        </a>
    );
}

function SiteFooter({ routes }: { routes: IShellRouteMap }) {
    const footerLinks = [
        { href: routes.howItWorks, label: 'How it works' },
        { href: routes.legalPrivacy, label: 'Privacy' },
        { href: routes.legalTerms, label: 'Terms' },
        { href: routes.contact, label: 'Contact' },
    ];

    return (
        <footer className={styles.publicFooter}>
            <div className={styles.publicFooterInner}>
                <div className={styles.footerBrand}>
                    <a className={styles.footerWordmark} href={routes.home}>
                        PickFlick
                    </a>
                    <p>Pick a film. Watch together. Remember everything.</p>
                </div>
                <nav aria-label="Footer navigation">
                    {footerLinks.map((link, index) => (
                        <Fragment key={link.label}>
                            {index > 0 ? <span aria-hidden="true">·</span> : null}
                            <a href={link.href}>{link.label}</a>
                        </Fragment>
                    ))}
                </nav>
            </div>
        </footer>
    );
}

export function PublicShell({
    children,
    currentPage,
    routes = canonicalRoutes,
}: {
    children: ReactNode;
    currentPage?: 'pricing';
    routes?: IShellRouteMap;
}) {
    return (
        <div className={styles.shell} data-shell="public">
            <header className={styles.publicHeader}>
                <div className={styles.headerInner}>
                    <Brand href={routes.home} />
                    <nav aria-label="Public navigation" className={styles.publicNav}>
                        {publicNavigation(routes, currentPage).map((item) => (
                            <a
                                aria-current={item.current ? 'page' : undefined}
                                href={item.href}
                                key={item.label}
                            >
                                {item.label}
                            </a>
                        ))}
                    </nav>
                    <div className={styles.publicHeaderAction}>
                        <ButtonLink href={routes.product} size="small">
                            Go to App
                        </ButtonLink>
                    </div>
                </div>
            </header>
            <main>{children}</main>
            <SiteFooter routes={routes} />
        </div>
    );
}

export function SetupShell({
    children,
    description,
    routes = canonicalRoutes,
    title,
}: {
    children: ReactNode;
    description: string;
    routes?: IShellRouteMap;
    title: string;
}) {
    return (
        <div className={`${styles.shell} ${styles.setupShell}`} data-shell="setup">
            <header className={styles.compactHeader}>
                <div className={styles.headerInner}>
                    <Brand href={routes.home} />
                    <a className={styles.compactLink} href={routes.home}>
                        Back to main
                    </a>
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

interface IProductShellProps {
    readonly children: ReactNode;
    readonly clubItems: readonly IShellNavigationItem[];
    /** `recovery` marks error states, where no product destination is current. */
    readonly currentArea: TShellArea;
    readonly eyebrow: string;
    readonly title: string;
    readonly admin?: boolean;
    readonly routes?: IShellRouteMap | undefined;
}

function ProductChrome({
    admin = false,
    children,
    clubItems,
    currentArea,
    libraryItems,
    routes = canonicalRoutes,
    sessionBackHref,
    settingsItems,
}: {
    admin?: boolean;
    children: ReactNode;
    clubItems: readonly IShellNavigationItem[];
    currentArea: IProductShellProps['currentArea'];
    libraryItems?: readonly IShellNavigationItem[] | undefined;
    routes?: IShellRouteMap | undefined;
    sessionBackHref?: string;
    settingsItems?: readonly IShellNavigationItem[] | undefined;
}) {
    const desktopItems = (currentArea === 'session' ? [] : productNavigation(routes)).map(
        (item) => ({
            ...item,
            current:
                (item.label === 'Hub' && ['hub', 'session'].includes(currentArea)) ||
                (item.label === 'My Library' && currentArea === 'library'),
        }),
    );
    return (
        <ProductOverlayProvider>
            <div className={`${styles.shell} ${styles.productShell}`} data-shell={currentArea}>
                <header className={styles.productHeader}>
                    <div className={styles.headerInner}>
                        <Brand href={routes.home} />
                        <nav aria-label="Product navigation" className={styles.productDesktopNav}>
                            {desktopItems.map((item) => (
                                <a
                                    aria-current={item.current ? 'page' : undefined}
                                    href={item.href}
                                    key={item.label}
                                >
                                    {item.label}
                                </a>
                            ))}
                        </nav>
                        <div className={styles.productHeaderControls}>
                            {sessionBackHref ? (
                                <a
                                    className={`${styles.secondaryAction} ${styles.sessionHeaderBack}`}
                                    href={sessionBackHref}
                                >
                                    ← Back to Hub
                                </a>
                            ) : null}
                            <ProductHeaderActions accountItems={accountNavigation(routes, admin)} />
                        </div>
                    </div>
                    <ProductSearch />
                </header>
                {children}
                <SiteFooter routes={routes} />
                <MobileProductNavigation
                    entries={mobileNavigation({
                        admin,
                        clubItems,
                        currentArea,
                        libraryItems,
                        routes,
                        settingsItems,
                    })}
                />
            </div>
        </ProductOverlayProvider>
    );
}

export function ProductFrame({
    admin = false,
    children,
    clubItems = [],
    currentArea = 'hub',
    routes,
}: {
    admin?: boolean;
    children: ReactNode;
    clubItems?: readonly IShellNavigationItem[];
    currentArea?: 'hub' | 'recovery';
    routes?: IShellRouteMap;
}) {
    return (
        <ProductChrome
            admin={admin}
            clubItems={clubItems}
            currentArea={currentArea}
            routes={routes}
        >
            {children}
        </ProductChrome>
    );
}

export function ProductShell({
    admin = false,
    children,
    clubItems,
    currentArea,
    eyebrow,
    routes,
    title,
}: IProductShellProps) {
    return (
        <ProductChrome
            admin={admin}
            clubItems={clubItems}
            currentArea={currentArea}
            routes={routes}
        >
            <main className={styles.productMain}>
                <header className={styles.pageHeading}>
                    <div>
                        <p className={styles.eyebrow}>{eyebrow}</p>
                        <h1>{title}</h1>
                    </div>
                    <a
                        className={styles.headerCta}
                        href={routes?.session ?? canonicalRoutes.session}
                    >
                        Primary action
                    </a>
                </header>
                <nav aria-label="Club sections" className={styles.contextTabs}>
                    {clubItems.map((item) => (
                        <a
                            aria-current={item.current ? 'page' : undefined}
                            href={item.href}
                            key={item.label}
                        >
                            {item.label}
                        </a>
                    ))}
                </nav>
                {children}
            </main>
        </ProductChrome>
    );
}

export function SessionShell({
    admin = false,
    children,
    clubItems,
    routes,
}: {
    admin?: boolean;
    children: ReactNode;
    clubItems: readonly IShellNavigationItem[];
    routes?: IShellRouteMap;
}) {
    return (
        <ProductChrome
            admin={admin}
            clubItems={clubItems}
            currentArea="session"
            routes={routes}
            sessionBackHref={routes?.product ?? canonicalRoutes.product}
        >
            <main className={styles.sessionMain}>
                <StatusBanner>
                    Session status and timing appear in this stable announced region.
                </StatusBanner>
                <section aria-labelledby="session-shell-title" className={styles.sessionHero}>
                    <div aria-hidden="true" className={styles.posterPlaceholder}>
                        Poster
                    </div>
                    <div className={styles.sessionHeroCopy}>
                        <div className={styles.pillRow}>
                            <Pill>Session phase</Pill>
                            <Pill tone="warm">Active</Pill>
                        </div>
                        <p className={styles.eyebrow}>Session detail shell</p>
                        <h1 id="session-shell-title">Film and Session context</h1>
                        <p>
                            Phase-specific content inherits this shared hero, status, actions, and
                            detail structure.
                        </p>
                        <div className={styles.actionRow}>
                            <a className={styles.headerCta} href="#phase-content">
                                Primary phase action
                            </a>
                            <a className={styles.secondaryAction} href="#session-details">
                                Session controls
                            </a>
                        </div>
                    </div>
                </section>
                <div id="phase-content">{children}</div>
            </main>
        </ProductChrome>
    );
}

interface IControlShellProps {
    readonly admin?: boolean;
    readonly children: ReactNode;
    readonly clubItems: readonly IShellNavigationItem[];
    readonly currentArea: 'library' | 'settings';
    readonly description: string;
    readonly items: readonly IShellNavigationItem[];
    readonly routes?: IShellRouteMap;
    readonly title: string;
}

export function ControlShell({
    admin = false,
    children,
    clubItems,
    currentArea,
    description,
    items,
    routes,
    title,
}: IControlShellProps) {
    return (
        <ProductChrome
            admin={admin}
            clubItems={clubItems}
            currentArea={currentArea}
            libraryItems={currentArea === 'library' ? items : undefined}
            routes={routes}
            settingsItems={currentArea === 'settings' ? items : undefined}
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
}: {
    children: ReactNode;
    clubItems: readonly IShellNavigationItem[];
    items: readonly IShellNavigationItem[];
    routes?: IShellRouteMap;
}) {
    return (
        <ProductChrome admin clubItems={clubItems} currentArea="admin" routes={routes}>
            <main className={`${styles.controlMain} ${styles.adminMain}`}>
                <header className={styles.pageHeading}>
                    <div>
                        <p className={styles.eyebrow}>Application control</p>
                        <h1>Admin Panel</h1>
                        <p>
                            Protected operational content renders inside a distinct administration
                            shell.
                        </p>
                    </div>
                    <Pill tone="warm">App Admin</Pill>
                </header>
                <SectionNavigation items={items} label="Admin sections" />
                <div className={styles.controlContent}>{children}</div>
            </main>
        </ProductChrome>
    );
}

export function ShellPlaceholder({ children, title }: { children: ReactNode; title: string }) {
    return (
        <section
            aria-labelledby={`${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}-title`}
            className={styles.placeholderPanel}
        >
            <h2 id={`${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}-title`}>{title}</h2>
            <div>{children}</div>
        </section>
    );
}

export function DenseRegion({ label }: { label: string }) {
    return (
        <BoundedScrollRegion label={label}>
            <div className={styles.denseGrid}>
                {['Column one', 'Column two', 'Column three', 'Column four'].map((heading) => (
                    <strong key={heading}>{heading}</strong>
                ))}
                {Array.from({ length: 8 }, (_, index) => (
                    <span key={index}>Content</span>
                ))}
            </div>
        </BoundedScrollRegion>
    );
}
