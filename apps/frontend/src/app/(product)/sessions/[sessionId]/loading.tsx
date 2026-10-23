import ProductFrame from '#components/shells/ProductFrame/ProductFrame';
import LoadingState from '#components/ui/LoadingState/LoadingState';

import styles from './page.module.scss';

export default function Loading() {
    return (
        <ProductFrame>
            <main className={styles.main} aria-busy="true">
                <h1 className="visually-hidden">Session</h1>
                <LoadingState label="Loading Session and participation…" variant="film" />
            </main>
        </ProductFrame>
    );
}
