'use client';

import { useState } from 'react';

import { InfoTip } from '@pickflick/ui';

import styles from '@/components/clubs/SelectionScaleField/SelectionScaleField.module.scss';

const SELECTION_SCALE_CEILING = 10;

export interface SelectionScaleFieldProps {
    readonly defaultMax: number;
    readonly disabled?: boolean;
    readonly idPrefix: string;
    readonly maxError?: string | undefined;
    /** The scale's first score. New Clubs start at 0; existing Clubs keep their stored start. */
    readonly min: number;
    readonly onChange?: (max: number) => void;
}

/**
 * Club Selection scale: one slider for the inclusive upper bound, never above 10.
 * Submits `selectionScaleMin` and `selectionScaleMax` with the surrounding form.
 */
export function SelectionScaleField({
    defaultMax,
    disabled = false,
    idPrefix,
    maxError,
    min,
    onChange,
}: SelectionScaleFieldProps) {
    const [max, setMax] = useState(defaultMax);
    const maxId = `${idPrefix}-max`;
    const summaryId = `${idPrefix}-summary`;
    const maxErrorId = `${idPrefix}-max-error`;

    return (
        <div className={styles.scale}>
            <div className={styles.labelRow}>
                <label className={styles.label} htmlFor={maxId}>
                    Selection score range
                </label>
                <InfoTip label="About the Selection score range">
                    The highest score members can give a nomination during Selection. Scores start
                    at {min}.
                </InfoTip>
            </div>
            <input name="selectionScaleMin" type="hidden" value={min} />
            <div className={styles.rangeRow}>
                <input
                    aria-describedby={maxError ? `${summaryId} ${maxErrorId}` : summaryId}
                    aria-invalid={maxError ? true : undefined}
                    aria-valuetext={`Scores run ${min} to ${max}`}
                    className={styles.range}
                    disabled={disabled}
                    id={maxId}
                    max={SELECTION_SCALE_CEILING}
                    min={min + 1}
                    name="selectionScaleMax"
                    onChange={(event) => {
                        const next = Number(event.currentTarget.value);
                        setMax(next);
                        onChange?.(next);
                    }}
                    step={1}
                    type="range"
                    value={max}
                />
                <span aria-hidden="true" className={styles.value}>
                    {max}
                </span>
            </div>
            <p className={styles.summary} id={summaryId}>
                Members score nominations {min}–{max}
            </p>
            {maxError ? (
                <p className={styles.error} id={maxErrorId}>
                    {maxError}
                </p>
            ) : null}
        </div>
    );
}
