import type { ReactNode } from 'react';

import styles from './NominationMovieList.module.scss';

export default function NominationMovieList({
    children,
    label,
    ordered = false,
}: {
    children: ReactNode;
    label: string;
    ordered?: boolean;
}) {
    const List = ordered ? 'ol' : 'ul';
    return (
        <div className={styles.scroller}>
            <List className={styles.list} aria-label={label}>
                {children}
            </List>
        </div>
    );
}
