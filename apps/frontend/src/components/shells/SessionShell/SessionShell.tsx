import type { ReactNode } from 'react';

import ProductChrome from '#components/shells/ProductChrome/ProductChrome';
import {
    canonicalRoutes,
    type IShellNavigationItem,
    type IShellRouteMap,
} from '#components/shells/shell-navigation';
import styles from '#components/shells/shells.module.scss';
import Pill from '#components/ui/Pill/Pill';
import StatusBanner from '#components/ui/StatusBanner/StatusBanner';

interface ISessionShellProps {
    admin?: boolean;
    children: ReactNode;
    clubItems: readonly IShellNavigationItem[];
    routes?: IShellRouteMap;
}

export default function SessionShell({
    admin = false,
    children,
    clubItems,
    routes,
}: ISessionShellProps) {
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
