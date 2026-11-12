import ProductChrome from '#components/shells/ProductChrome/ProductChrome';
import LoadingState from '#components/ui/LoadingState/LoadingState';
import Skeleton from '#components/ui/Skeleton/Skeleton';

import styles from './page.module.scss';

export default function SettingsLoading() {
    return (
        <ProductChrome clubItems={[]} currentArea="settings">
            <main className={styles.settings}>
                <header className={styles.settings__heading}>
                    <div>
                        <h1>Settings</h1>
                        <p>
                            Manage your profile, notifications, subscription, privacy, and personal
                            data.
                        </p>
                    </div>
                </header>
                <LoadingState label="Loading Settings…">
                    <div className={styles.settings__layout}>
                        <aside className={styles.settings__sidebar} aria-hidden="true">
                            <Skeleton variant="avatar" />
                            <Skeleton />
                            <Skeleton />
                            <Skeleton />
                        </aside>
                        <section className={styles.card} aria-label="Loading profile">
                            <Skeleton width="short" />
                            <Skeleton variant="avatar" />
                            <Skeleton variant="control" />
                            <Skeleton variant="control" />
                            <Skeleton variant="control" />
                            <Skeleton variant="control" width="short" />
                        </section>
                    </div>
                </LoadingState>
            </main>
        </ProductChrome>
    );
}
