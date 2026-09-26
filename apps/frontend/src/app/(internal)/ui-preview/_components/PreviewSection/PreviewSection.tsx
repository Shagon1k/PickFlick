import type { ReactNode } from 'react';

import styles from '../../page.module.scss';

interface IPreviewSectionProps {
    children: ReactNode;
    description: string;
    kicker: string;
    title: string;
}

export default function PreviewSection({
    children,
    description,
    kicker,
    title,
}: IPreviewSectionProps) {
    const id = kicker.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase();
    return (
        <section
            aria-labelledby={`${id}-title`}
            className={styles.section}
            id={['forms', 'navigation'].find((anchor) => id.includes(anchor)) ?? id}
        >
            <header className={styles.sectionHeader}>
                <div>
                    <span className={styles.sectionKicker}>{kicker}</span>
                    <h2 id={`${id}-title`}>{title}</h2>
                </div>
                <p>{description}</p>
            </header>
            {children}
        </section>
    );
}
