import styles from './Field.module.scss';

/** A field label with an optional quiet qualifier such as "required" or "optional". */
export default function FieldLabel({ label, hint }: { label: string; hint?: string }) {
    return (
        <>
            {label}
            {hint ? <span className={styles['field__label-hint']}> — {hint}</span> : null}
        </>
    );
}
