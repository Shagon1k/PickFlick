import type { ReactNode } from 'react';

import styles from './ShellPlaceholder.module.scss';

interface IShellPlaceholderProps {
    children: ReactNode;
    title: string;
}

export default function ShellPlaceholder({ children, title }: IShellPlaceholderProps) {
    const titleId = `${title.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}-title`;

    return (
        <section aria-labelledby={titleId} className={styles.placeholderPanel}>
            <h2 id={titleId}>{title}</h2>
            <div>{children}</div>
        </section>
    );
}
