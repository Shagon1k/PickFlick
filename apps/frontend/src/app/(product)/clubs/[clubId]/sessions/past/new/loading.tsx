import styles from '../../session-form-page.module.scss';

export default function LoadingPastSession() {
    return (
        <main className={styles.main}>
            <section className={styles.card} aria-busy="true">
                <h1>Log a Past Session</h1>
                <p role="status">Loading Club history and attendees…</p>
            </section>
        </main>
    );
}
