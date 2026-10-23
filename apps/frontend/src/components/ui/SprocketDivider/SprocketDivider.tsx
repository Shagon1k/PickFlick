import clsx from 'clsx';

import styles from './SprocketDivider.module.scss';

/** Decorative film-sprocket rule that closes a cinematic scene. */
export default function SprocketDivider({
    variant = 'default',
}: {
    variant?: 'default' | 'section';
}) {
    return (
        <div aria-hidden="true" className={clsx(styles.sprocketDivider, styles[`m-${variant}`])}>
            <i />
            <i />
            <i />
        </div>
    );
}
