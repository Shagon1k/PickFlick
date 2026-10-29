import type { ReactNode } from 'react';

import ProductChrome from '#components/shells/ProductChrome/ProductChrome';
import SectionNavigation from '#components/shells/SectionNavigation/SectionNavigation';
import type { IShellNavigationItem, IShellRouteMap } from '#components/shells/shell-navigation';
import styles from '#components/shells/shells.module.scss';

interface IControlShellProps {
    isAdmin?: boolean;
    children: ReactNode;
    clubItems: readonly IShellNavigationItem[];
    currentArea: 'library' | 'settings';
    description: string;
    items: readonly IShellNavigationItem[];
    routes?: IShellRouteMap;
    title: string;
    summary?: ReactNode;
}

export default function ControlShell({
    isAdmin = false,
    children,
    clubItems,
    currentArea,
    description,
    items,
    routes,
    title,
    summary,
}: IControlShellProps) {
    return (
        <ProductChrome
            isAdmin={isAdmin}
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
                    {summary && <div className={styles.controlSummary}>{summary}</div>}
                </header>
                <SectionNavigation items={items} label={`${title} sections`} />
                <div className={styles.controlContent}>{children}</div>
            </main>
        </ProductChrome>
    );
}
