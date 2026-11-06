import Link from 'next/link';
import type { ReactNode } from 'react';

import ProductChrome from '#components/shells/ProductChrome/ProductChrome';
import SectionTabs from '#components/shells/SectionTabs/SectionTabs';
import {
    canonicalRoutes,
    type IShellNavigationItem,
    type IShellRouteMap,
    type TShellArea,
} from '#components/shells/shell-navigation';
import styles from '#components/shells/shells.module.scss';

interface IProductShellProps {
    isAdmin?: boolean;
    children: ReactNode;
    clubItems: readonly IShellNavigationItem[];
    currentArea: TShellArea;
    eyebrow: string;
    routes?: IShellRouteMap | undefined;
    title: string;
}

export default function ProductShell({
    isAdmin = false,
    children,
    clubItems,
    currentArea,
    eyebrow,
    routes,
    title,
}: IProductShellProps) {
    return (
        <ProductChrome
            isAdmin={isAdmin}
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
                    <Link
                        className={styles.headerCta}
                        href={routes?.session ?? canonicalRoutes.session}
                    >
                        Primary action
                    </Link>
                </header>
                <SectionTabs items={clubItems} label="Club sections">
                    {children}
                </SectionTabs>
            </main>
        </ProductChrome>
    );
}
