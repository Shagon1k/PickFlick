import type { ReactNode } from 'react';

import ProductChrome from '@/components/shells/ProductChrome/ProductChrome';
import {
    canonicalRoutes,
    type IShellNavigationItem,
    type IShellRouteMap,
    type TShellArea,
} from '@/components/shells/shell-navigation';
import styles from '@/components/shells/shells.module.scss';

interface IProductShellProps {
    admin?: boolean;
    children: ReactNode;
    clubItems: readonly IShellNavigationItem[];
    currentArea: TShellArea;
    eyebrow: string;
    routes?: IShellRouteMap | undefined;
    title: string;
}

export default function ProductShell({
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
