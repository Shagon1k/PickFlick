import ProductFrame from '#components/shells/ProductFrame/ProductFrame';
import LoadingState from '#components/ui/LoadingState/LoadingState';

import styles from './page.module.scss';

export default function Loading() {
    return (
        <ProductFrame>
            <main className={styles.movieMain} aria-busy="true">
                <h1 className="visually-hidden">Movie Details</h1>
                <LoadingState label="Loading film details…" variant="film" />
            </main>
        </ProductFrame>
    );
}
