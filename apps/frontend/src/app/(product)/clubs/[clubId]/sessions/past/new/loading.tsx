import BrandImage from '#components/ui/BrandImage/BrandImage';
import Icon from '#components/ui/Icon/Icon';
import Skeleton from '#components/ui/Skeleton/Skeleton';
import SprocketDivider from '#components/ui/SprocketDivider/SprocketDivider';

import styles from '../../session-form-page.module.scss';
import PastSessionFormLoading from './_components/PastSessionForm/PastSessionFormLoading';

export default function LoadingPastSession() {
    return (
        <main className={styles.main}>
            <span className={styles.back} aria-hidden="true">
                <Icon name="arrow-left" />
                <Skeleton text="Back" />
            </span>
            <section className={styles.scene} aria-busy="true">
                <BrandImage
                    alt=""
                    asset="sessionManagement"
                    className={styles.mascot}
                    loading="eager"
                />
                <div className={styles.card}>
                    <h1>Log a Past Session</h1>
                    <p className={styles.lead}>
                        Add a screening that already happened to your Club’s history.
                    </p>
                    <span className="visually-hidden" role="status">
                        Loading the past Session form…
                    </span>
                    <PastSessionFormLoading />
                </div>
                <SprocketDivider />
                <p className={styles.ornament} aria-hidden="true">
                    <Skeleton text="Shared history" />
                </p>
            </section>
        </main>
    );
}
