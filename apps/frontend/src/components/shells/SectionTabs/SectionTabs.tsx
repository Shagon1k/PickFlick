import Link from 'next/link';

import type { IShellNavigationItem } from '#components/shells/shell-navigation';

import styles from './SectionTabs.module.scss';

/** The underlined section links of the Club Hub and My Library; phones use the bottom bar. */
export default function SectionTabs({
    items,
    label,
}: {
    items: readonly IShellNavigationItem[];
    label: string;
}) {
    return (
        <nav aria-label={label} className={styles.tabs}>
            <div className={styles.tabsInner}>
                {items.map((item) => (
                    <Link
                        aria-current={item.current ? 'page' : undefined}
                        href={item.href}
                        key={item.label}
                        scroll={false}
                    >
                        {item.label}
                    </Link>
                ))}
            </div>
        </nav>
    );
}
