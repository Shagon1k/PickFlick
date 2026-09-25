import styles from './SprocketDivider.module.scss';

/** Decorative film-sprocket rule that closes a cinematic scene. */
export default function SprocketDivider() {
    return (
        <div aria-hidden="true" className={styles['sprocket-divider']}>
            <i />
            <i />
            <i />
        </div>
    );
}
