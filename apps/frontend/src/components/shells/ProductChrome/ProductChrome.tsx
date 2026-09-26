import type { ReactNode } from 'react';

import Brand from '@/components/shells/Brand/Brand';
import MobileProductNavigation from '@/components/shells/MobileProductNavigation/MobileProductNavigation';
import { ProductOverlayProvider } from '@/components/shells/product-overlay';
import ProductHeaderActions from '@/components/shells/ProductHeaderActions/ProductHeaderActions';
import ProductSearch from '@/components/shells/ProductSearch/ProductSearch';
import {
    accountNavigation,
    canonicalRoutes,
    type IShellNavigationItem,
    type IShellRouteMap,
    mobileNavigation,
    productNavigation,
    type TShellArea,
} from '@/components/shells/shell-navigation';
import styles from '@/components/shells/shells.module.scss';
import SiteFooter from '@/components/shells/SiteFooter/SiteFooter';

interface IProductChromeProps {
    admin?: boolean;
    children: ReactNode;
    clubItems: readonly IShellNavigationItem[];
    /** `recovery` marks error states, where no product destination is current. */
    currentArea: TShellArea;
    libraryItems?: readonly IShellNavigationItem[] | undefined;
    routes?: IShellRouteMap | undefined;
    sessionBackHref?: string;
    settingsItems?: readonly IShellNavigationItem[] | undefined;
}

/** The header, footer, and mobile navigation every signed-in shell shares. */
export default function ProductChrome({
    admin = false,
    children,
    clubItems,
    currentArea,
    libraryItems,
    routes = canonicalRoutes,
    sessionBackHref,
    settingsItems,
}: IProductChromeProps) {
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
