import Link from 'next/link';
import type { ReactNode } from 'react';

import Brand from '@/components/shells/Brand/Brand';
import { canonicalRoutes, type IShellRouteMap } from '@/components/shells/shell-navigation';
import styles from '@/components/shells/shells.module.scss';

interface ISetupShellProps {
    children: ReactNode;
    description: string;
    routes?: IShellRouteMap;
    title: string;
}

export default function SetupShell({
    children,
    description,
    routes = canonicalRoutes,
    title,
}: ISetupShellProps) {
    return (
        <div className={`${styles.shell} ${styles.setupShell}`} data-shell="setup">
            <header className={styles.compactHeader}>
                <div className={styles.headerInner}>
                    <Brand href={routes.home} />
                    <Link className={styles.compactLink} href={routes.home}>
                        Back to main
                    </Link>
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
