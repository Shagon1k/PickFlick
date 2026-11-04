import ProductFrame from '#components/shells/ProductFrame/ProductFrame';

import MovieHeroLoading from './_components/MovieHeroLoading/MovieHeroLoading';
import styles from './page.module.scss';

export default function Loading() {
    return (
        <ProductFrame>
            <main className={styles.movieMain} aria-busy="true">
                <h1 className="visually-hidden">Movie Details</h1>
                <MovieHeroLoading />
            </main>
        </ProductFrame>
    );
}
