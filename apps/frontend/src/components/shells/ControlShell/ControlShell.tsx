import type { ReactNode } from 'react';

import ProductChrome from '#components/shells/ProductChrome/ProductChrome';
import SectionTabs from '#components/shells/SectionTabs/SectionTabs';
import type { IShellNavigationItem, IShellRouteMap } from '#components/shells/shell-navigation';
import styles from '#components/shells/shells.module.scss';
import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';

interface IControlShellProps {
    isAdmin?: boolean;
    children: ReactNode;
    clubItems: readonly IShellNavigationItem[];
    currentArea: 'library' | 'settings';
    description?: string;
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
                        <p className={styles.eyebrow}>Personal archive</p>
                        <h1>{title}</h1>
                        {description ? <p>{description}</p> : null}
                    </div>
                    {summary && <div className={styles.controlSummary}>{summary}</div>}
                </header>
                {summary ? <SprocketDivider variant="section" /> : null}
                <SectionTabs items={items} label={title} />
                <div className={styles.controlContent}>{children}</div>
            </main>
        </ProductChrome>
    );
}
