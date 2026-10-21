import styles from './FilmProgress.module.scss';

const FRAME_COUNT = 20;
const FULL_PROGRESS = 100;

export default function FilmProgress({
    value,
    max,
    label,
}: {
    value: number;
    max: number;
    label: string;
}) {
    const percentage = Math.min(
        FULL_PROGRESS,
        Math.max(0, (value / Math.max(1, max)) * FULL_PROGRESS),
    );
    const filled = Math.round((percentage / FULL_PROGRESS) * FRAME_COUNT);
    return (
        <div
            className={styles.film}
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={FULL_PROGRESS}
            aria-valuenow={percentage}
        >
            {Array.from({ length: FRAME_COUNT }, (_, index) => (
                <i key={index} aria-hidden="true" data-active={index < filled || undefined} />
            ))}
        </div>
    );
}
