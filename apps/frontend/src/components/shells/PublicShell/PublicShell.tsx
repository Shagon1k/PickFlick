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
    variant?: 'default' | 'focused';
    routes?: IShellRouteMap;
}

export default function PublicShell({
    children,
    currentPage,
    variant = 'default',
    routes = canonicalRoutes,
}: IPublicShellProps) {
    return (
        <div className={styles.shell} data-shell="public">
            {variant === 'default' ? (
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
            ) : null}
            <main>{children}</main>
            {variant === 'default' ? <SiteFooter routes={routes} /> : null}
        </div>
    );
}
