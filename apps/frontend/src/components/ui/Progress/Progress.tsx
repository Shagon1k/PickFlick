import styles from './Progress.module.scss';

export interface IProgressProps {
    label: string;
    value: number;
    max: number;
    isCompact?: boolean;
    variant?: 'default' | 'usage';
}

export default function Progress({
    isCompact = false,
    label,
    max,
    value,
    variant = 'default',
}: IProgressProps) {
    const safeMax = Math.max(1, max);
    const safeValue = Math.min(Math.max(0, value), safeMax);
    return (
        <div
            className={styles.progress}
            data-compact={isCompact || undefined}
            data-variant={variant}
        >
            <div className={styles.progress__copy}>
                <span>{label}</span>
                <strong>
                    {variant === 'usage' ? `${value} / ${max}` : `${safeValue}/${safeMax}`}
                </strong>
            </div>
            <progress aria-label={label} max={safeMax} value={safeValue} />
        </div>
    );
}
