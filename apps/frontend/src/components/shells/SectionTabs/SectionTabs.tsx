import Link from 'next/link';
import type { ReactNode } from 'react';

import type { IShellNavigationItem } from '#components/shells/shell-navigation';

import styles from './SectionTabs.module.scss';

/** The underlined section links of the Club Hub and My Library; phones use the bottom bar. */
export default function SectionTabs({
    items,
    label,
    children,
}: {
    items: readonly IShellNavigationItem[];
    label: string;
    children: ReactNode;
}) {
    return (
        <>
            <nav aria-label={label} className={styles.tabs}>
                <div className={styles.tabsInner}>
                    {items.map((item) => (
                        <Link
                            aria-current={item.current ? 'page' : undefined}
                            data-press-feedback
                            href={item.href}
                            key={item.label}
                            scroll={false}
                        >
                            <span className={styles.tabs__label} data-press-surface>
                                {item.label}
                            </span>
                        </Link>
                    ))}
                </div>
            </nav>
            <div className={styles.panel}>{children}</div>
        </>
    );
}
