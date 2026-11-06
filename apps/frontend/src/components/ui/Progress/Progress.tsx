import styles from './Progress.module.scss';

export interface IProgressProps {
    label: string;
    value: number;
    max: number;
    isCompact?: boolean;
}

export default function Progress({ isCompact = false, label, max, value }: IProgressProps) {
    const safeMax = Math.max(1, max);
    const safeValue = Math.min(Math.max(0, value), safeMax);
    return (
        <div className={styles.progress} data-compact={isCompact || undefined}>
            <div className={styles.progress__copy}>
                <span>{label}</span>
                <strong>
                    {safeValue}/{safeMax}
                </strong>
            </div>
            <progress aria-label={label} max={safeMax} value={safeValue} />
        </div>
    );
}
