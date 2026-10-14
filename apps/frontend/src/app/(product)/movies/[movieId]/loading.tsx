import ProductFrame from '#components/shells/ProductFrame/ProductFrame';

import styles from './page.module.scss';

export default function Loading() {
    return (
        <ProductFrame>
            <main className={styles.movieMain} aria-busy="true">
                <h1>Movie Details</h1>
                <p role="status">Loading film details…</p>
            </main>
        </ProductFrame>
    );
}
