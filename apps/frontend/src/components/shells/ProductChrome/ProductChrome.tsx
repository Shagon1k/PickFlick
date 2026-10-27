import Link from 'next/link';
import type { ReactNode } from 'react';

import PendingInvites from '#components/clubs/PendingInvites/PendingInvites';
import AutoHideHeader from '#components/shells/AutoHideHeader/AutoHideHeader';
import Brand from '#components/shells/Brand/Brand';
import MobileProductNavigation from '#components/shells/MobileProductNavigation/MobileProductNavigation';
import NotificationsProvider from '#components/shells/NotificationsProvider/NotificationsProvider';
import ProductHeaderActions from '#components/shells/ProductHeaderActions/ProductHeaderActions';
import ProductOverlayProvider from '#components/shells/ProductOverlayProvider/ProductOverlayProvider';
import ProductSearch from '#components/shells/ProductSearch/ProductSearch';
import {
    buildAccountNavigation,
    buildMobileNavigation,
    buildProductNavigation,
    canonicalRoutes,
    type IShellNavigationItem,
    type IShellRouteMap,
    type TShellArea,
} from '#components/shells/shell-navigation';
import styles from '#components/shells/shells.module.scss';
import SiteFooter from '#components/shells/SiteFooter/SiteFooter';
import ButtonLink from '#components/ui/Button/ButtonLink';
import Icon from '#components/ui/Icon/Icon';

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
    const desktopItems = (currentArea === 'session' ? [] : buildProductNavigation(routes)).map(
        (item) => ({
            ...item,
            current:
                (item.label === 'Hub' && ['hub', 'session'].includes(currentArea)) ||
                (item.label === 'My Library' && currentArea === 'library'),
        }),
    );
    return (
        <ProductOverlayProvider>
            <NotificationsProvider>
                <div className={`${styles.shell} ${styles.productShell}`} data-shell={currentArea}>
                    <AutoHideHeader className={styles.productHeader}>
                        <div className={styles.headerInner}>
                            <Brand href={routes.home} />
                            <nav
                                aria-label="Product navigation"
                                className={styles.productDesktopNav}
                            >
                                {desktopItems.map((item) => (
                                    <Link
                                        aria-current={item.current ? 'page' : undefined}
                                        href={item.href}
                                        key={item.label}
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                            </nav>
                            <div className={styles.productHeaderControls}>
                                {sessionBackHref ? (
                                    <span className={styles.sessionHeaderBack}>
                                        <ButtonLink href={sessionBackHref} size="small">
                                            <Icon name="arrow-left" />
                                            Back to Hub
                                        </ButtonLink>
                                    </span>
                                ) : null}
                                <ProductHeaderActions
                                    accountItems={buildAccountNavigation(routes, admin)}
                                />
                            </div>
                        </div>
                        <ProductSearch />
                    </AutoHideHeader>
                    {children}
                    <SiteFooter routes={routes} />
                    <PendingInvites />
                    <MobileProductNavigation
                        entries={buildMobileNavigation({
                            admin,
                            clubItems,
                            currentArea,
                            libraryItems,
                            routes,
                            settingsItems,
                        })}
                    />
                </div>
            </NotificationsProvider>
        </ProductOverlayProvider>
    );
}
