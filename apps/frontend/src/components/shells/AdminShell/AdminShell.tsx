import type { ReactNode } from 'react';

import ProductChrome from '#components/shells/ProductChrome/ProductChrome';
import SectionNavigation from '#components/shells/SectionNavigation/SectionNavigation';
import {
    canonicalRoutes,
    type IShellNavigationItem,
    type IShellRouteMap,
} from '#components/shells/shell-navigation';
import styles from '#components/shells/shells.module.scss';
import Pill from '#components/ui/Pill/Pill';

interface IAdminShellProps {
    children: ReactNode;
    clubItems: readonly IShellNavigationItem[];
    items: readonly IShellNavigationItem[];
    routes?: IShellRouteMap;
}

export default function AdminShell({
    children,
    clubItems,
    items,
    routes = canonicalRoutes,
}: IAdminShellProps) {
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
