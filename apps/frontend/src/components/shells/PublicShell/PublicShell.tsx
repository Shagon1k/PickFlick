import Link from 'next/link';
import type { ReactNode } from 'react';

import Brand from '#components/shells/Brand/Brand';
import {
    buildPublicNavigation,
    canonicalRoutes,
    type IShellRouteMap,
} from '#components/shells/shell-navigation';
import styles from '#components/shells/shells.module.scss';
import SiteFooter from '#components/shells/SiteFooter/SiteFooter';
import ButtonLink from '#components/ui/Button/ButtonLink';

interface IPublicShellProps {
    children: ReactNode;
    currentPage?: 'pricing';
    routes?: IShellRouteMap;
}

export default function PublicShell({
    children,
    currentPage,
    routes = canonicalRoutes,
}: IPublicShellProps) {
    return (
        <div className={styles.shell} data-shell="public">
            <header className={styles.publicHeader}>
                <div className={styles.headerInner}>
                    <Brand href={routes.home} />
                    <nav aria-label="Public navigation" className={styles.publicNav}>
                        {buildPublicNavigation(routes, currentPage).map((item) => (
                            <Link
                                aria-current={item.current ? 'page' : undefined}
                                href={item.href}
                                key={item.label}
                            >
                                {item.label}
                            </Link>
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
