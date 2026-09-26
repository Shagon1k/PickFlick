import styles from './SprocketDivider.module.scss';

/** Decorative film-sprocket rule that closes a cinematic scene. */
export default function SprocketDivider() {
    return (
        <div aria-hidden="true" className={styles.sprocketDivider}>
            <i />
            <i />
            <i />
        </div>
    );
}
