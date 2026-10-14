import ProductFrame from '#components/shells/ProductFrame/ProductFrame';

import styles from './page.module.scss';

export default function Loading() {
    return (
        <ProductFrame>
            <main className={styles.main} aria-busy="true">
                <h1>Session</h1>
                <p role="status">Loading Session and participation…</p>
            </main>
        </ProductFrame>
    );
}
